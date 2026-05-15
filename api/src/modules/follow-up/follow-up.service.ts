import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, Not, IsNull } from 'typeorm';
import { FollowUpJourney, JourneyStatus } from './follow-up-journey.entity';
import { FollowUpTask, TaskStatus } from './follow-up-task.entity';
import { Member, } from '../members/member.entity';
import { MemberStatus } from '@/types';
import dayjs from 'dayjs';

const DEFAULT_JOURNEY_STEPS = [
  { dayOffset: 0,  type: 'send_message',  label: 'Welcome message to convert' },
  { dayOffset: 0,  type: 'notify_worker', label: 'Assign worker notification' },
  { dayOffset: 1,  type: 'worker_action', label: 'Day-1 call reminder' },
  { dayOffset: 3,  type: 'worker_action', label: 'Day-3 visit reminder' },
  { dayOffset: 7,  type: 'send_message',  label: 'Week-1 pastor welcome' },
  { dayOffset: 14, type: 'send_message',  label: 'Foundation class invite' },
  { dayOffset: 21, type: 'send_message',  label: 'Cell group invite' },
  { dayOffset: 28, type: 'check_status',  label: 'Mid-journey check-in' },
  { dayOffset: 42, type: 'check_status',  label: 'Journey graduation review' },
];

@Injectable()
export class FollowUpService {
  constructor(
    @InjectRepository(FollowUpJourney)
    private readonly journeyRepo: Repository<FollowUpJourney>,
    @InjectRepository(FollowUpTask)
    private readonly taskRepo: Repository<FollowUpTask>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectQueue('follow-up')
    private readonly queue: Queue,
  ) {}

  async startJourney(churchId: string, memberId: string, decisionType: string, assignedWorkerId?: string) {
    // Prevent duplicate active journeys
    const existing = await this.journeyRepo.findOne({
      where: { churchId, memberId, status: JourneyStatus.ACTIVE },
    });
    if (existing) return existing;

    const journey = await this.journeyRepo.save(
      this.journeyRepo.create({ churchId, memberId, decisionType, assignedWorkerId: assignedWorkerId ?? null }),
    );

    const now = dayjs();
    const tasks = DEFAULT_JOURNEY_STEPS.map((step) =>
      this.taskRepo.create({
        churchId, journeyId: journey.id,
        type: step.type as never,
        triggerAt: now.add(step.dayOffset, 'day').toDate(),
        payload: { label: step.label },
      }),
    );

    const savedTasks = await this.taskRepo.save(tasks);

    // Queue tasks (non-fatal if Redis unavailable in dev)
    for (const task of savedTasks) {
      try {
        const delay = Math.max(0, task.triggerAt.getTime() - Date.now());
        await this.queue.add('process-task', { taskId: task.id }, { delay });
      } catch { /* queue unavailable in dev */ }
    }

    return journey;
  }

  async getFollowUpQueue(churchId: string) {
    // Members with new_convert status OR Follow-Up Needed tag NOT already in an active journey
    const activeJourneyMemberIds = await this.journeyRepo
      .createQueryBuilder('j')
      .select('j.memberId', 'memberId')
      .where('j.churchId = :churchId AND j.status = :status', { churchId, status: JourneyStatus.ACTIVE })
      .andWhere('j.memberId IS NOT NULL')
      .getRawMany()
      .then((rows) => rows.map((r: any) => r.memberId as string));

    const qb = this.memberRepo
      .createQueryBuilder('m')
      .where('m.churchId = :churchId', { churchId })
      .andWhere(`(m.status = :nc OR :tag = ANY(m.tags))`, { nc: MemberStatus.NEW_CONVERT, tag: 'Follow-Up Needed' });

    if (activeJourneyMemberIds.length > 0) {
      qb.andWhere('m.id NOT IN (:...ids)', { ids: activeJourneyMemberIds });
    }

    return qb.orderBy('m.createdAt', 'ASC').getMany();
  }

  async getJourneysWithMembers(churchId: string) {
    const journeys = await this.journeyRepo.find({
      where: { churchId, status: JourneyStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    if (!journeys.length) return [];

    const memberIds = journeys.map((j) => j.memberId).filter(Boolean);
    const members = memberIds.length ? await this.memberRepo.findByIds(memberIds) : [];
    const memberMap = new Map(members.map((m) => [m.id, m]));

    // Get task progress per journey
    const taskCounts = await this.taskRepo
      .createQueryBuilder('t')
      .select('t.journeyId', 'journeyId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END)`, 'done')
      .where('t.churchId = :churchId AND t.journeyId IN (:...ids)', {
        churchId,
        ids: journeys.map((j) => j.id),
      })
      .groupBy('t.journeyId')
      .getRawMany();

    const progressMap = new Map(
      taskCounts.map((r: any) => [r.journeyId, { total: parseInt(r.total), done: parseInt(r.done) }]),
    );

    return journeys.map((j) => ({
      ...j,
      member: memberMap.get(j.memberId) ?? null,
      progress: progressMap.get(j.id) ?? { total: DEFAULT_JOURNEY_STEPS.length, done: 0 },
    }));
  }

  getActiveJourneys(churchId: string) {
    return this.journeyRepo.find({ where: { churchId, status: JourneyStatus.ACTIVE } });
  }

  getJourneyTasks(journeyId: string, churchId: string) {
    return this.taskRepo.find({ where: { journeyId, churchId }, order: { triggerAt: 'ASC' } });
  }

  async assignWorker(churchId: string, journeyId: string, workerId: string) {
    await this.journeyRepo.update({ id: journeyId, churchId }, { assignedWorkerId: workerId });
    return this.journeyRepo.findOne({ where: { id: journeyId, churchId } });
  }

  async updateJourneyStatus(churchId: string, journeyId: string, status: JourneyStatus) {
    const update: Partial<FollowUpJourney> = { status };
    if (status === JourneyStatus.COMPLETED) update.completedAt = new Date();
    await this.journeyRepo.update({ id: journeyId, churchId }, update as any);
    return this.journeyRepo.findOne({ where: { id: journeyId, churchId } });
  }

  async completeTask(taskId: string) {
    await this.taskRepo.update(taskId, { status: TaskStatus.DONE, processedAt: new Date() });
  }

  async getStats(churchId: string) {
    const [active, completed, queueCount] = await Promise.all([
      this.journeyRepo.count({ where: { churchId, status: JourneyStatus.ACTIVE } }),
      this.journeyRepo.count({ where: { churchId, status: JourneyStatus.COMPLETED } }),
      this.getFollowUpQueue(churchId).then((q) => q.length),
    ]);
    return { active, completed, queueCount };
  }
}
