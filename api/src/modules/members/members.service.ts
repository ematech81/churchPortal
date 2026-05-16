import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { Member } from './member.entity';
import { MemberStatus, ChurchRole } from '@/types';

// Statuses that mean "this person is a pastor/minister in the directory"
const PASTORAL_STATUSES: string[] = [MemberStatus.PASTOR, MemberStatus.MINISTER];
const PASTORAL_ROLES:    string[] = [ChurchRole.PASTOR, ChurchRole.BRANCH_PASTOR];

/** Returns true when a churchRole value indicates a pastoral position */
function isPastoralRole(role?: string | null): boolean {
  return !!role && PASTORAL_ROLES.includes(role as ChurchRole);
}

/** Returns true when a status value is already pastoral */
function isPastoralStatus(status?: string | null): boolean {
  return !!status && PASTORAL_STATUSES.includes(status as MemberStatus);
}

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member)
    private readonly repo: Repository<Member>,
  ) {}

  // ── Unified pastoral query builder ─────────────────────────────────────────
  private pastoralQb(churchId: string) {
    return this.repo
      .createQueryBuilder('m')
      .where('m.churchId = :churchId', { churchId })
      .andWhere(
        "(m.status IN (:...pStatuses) OR m.churchRole IN (:...pRoles))",
        { pStatuses: PASTORAL_STATUSES, pRoles: PASTORAL_ROLES },
      );
  }

  // ── findAll ────────────────────────────────────────────────────────────────
  async findAll(churchId: string, search?: string, status?: string, limit = 100) {
    const take = Math.min(limit, 500);
    const isPastoral = status && (PASTORAL_STATUSES.includes(status) || status === 'pastoral');

    if (isPastoral) {
      // Return members who are pastors/ministers by EITHER status OR churchRole
      const qb = this.pastoralQb(churchId).orderBy('m.firstName', 'ASC').take(take);
      if (search?.trim()) {
        const s = `%${search.trim()}%`;
        qb.andWhere(
          '(m.firstName ILIKE :s OR m.lastName ILIKE :s OR m.phone ILIKE :s OR m.email ILIKE :s)',
          { s },
        );
      }
      return qb.getMany();
    }

    // Standard filter
    const statusFilter = status && status !== 'all' ? (status as MemberStatus) : undefined;

    if (search?.trim()) {
      const base = { churchId, ...(statusFilter ? { status: statusFilter } : {}) };
      return this.repo.find({
        where: [
          { ...base, firstName: ILike(`%${search}%`) },
          { ...base, lastName:  ILike(`%${search}%`) },
          { ...base, phone:     ILike(`%${search}%`) },
          { ...base, email:     ILike(`%${search}%`) },
          { ...base, memberId:  ILike(`%${search}%`) },
        ],
        order: { firstName: 'ASC' },
        take,
      });
    }

    return this.repo.find({
      where: { churchId, ...(statusFilter ? { status: statusFilter } : {}) },
      order: { firstName: 'ASC' },
      take,
    });
  }

  // ── count ──────────────────────────────────────────────────────────────────
  async count(churchId: string, status?: string) {
    const isPastoral = status && (PASTORAL_STATUSES.includes(status) || status === 'pastoral');
    if (isPastoral) {
      return this.pastoralQb(churchId).getCount();
    }
    const statusFilter = status && status !== 'all' ? (status as MemberStatus) : undefined;
    return this.repo.count({ where: { churchId, ...(statusFilter ? { status: statusFilter } : {}) } });
  }

  // ── Unified pastor count (used by dashboard) ───────────────────────────────
  async countPastors(churchId: string): Promise<number> {
    return this.pastoralQb(churchId).getCount();
  }

  // ── findByIdOrFail ─────────────────────────────────────────────────────────
  async findByIdOrFail(id: string, churchId: string) {
    const member = await this.repo.findOne({ where: { id, churchId } });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  // ── create ────────────────────────────────────────────────────────────────
  async create(churchId: string, data: Partial<Member>) {
    // Auto-sync: if churchRole is pastoral but status is not, elevate status to 'pastor'
    if (isPastoralRole(data.churchRole as string) && !isPastoralStatus(data.status as string)) {
      data.status = MemberStatus.PASTOR;
    }
    const memberId = await this._generateMemberId(churchId);
    return this.repo.save(this.repo.create({ ...data, churchId, memberId }));
  }

  // ── update ────────────────────────────────────────────────────────────────
  async update(id: string, churchId: string, data: Partial<Member>) {
    // Auto-sync: elevate status when a pastoral role is being assigned
    if (isPastoralRole(data.churchRole as string) && !isPastoralStatus(data.status as string)) {
      // Only auto-elevate if the existing record is also not pastoral
      const existing = await this.repo.findOne({ where: { id, churchId } });
      if (existing && !isPastoralStatus(existing.status)) {
        data.status = MemberStatus.PASTOR;
      }
    }
    await this.repo.update({ id, churchId }, data as any);
    return this.findByIdOrFail(id, churchId);
  }

  // ── syncPastoralRecords — fix existing data in one pass ───────────────────
  async syncPastoralRecords(churchId: string): Promise<{ fixed: number }> {
    // Find members who have a pastoral churchRole but a non-pastoral status
    const mismatched = await this.repo
      .createQueryBuilder('m')
      .where('m.churchId = :churchId', { churchId })
      .andWhere('m.churchRole IN (:...roles)', { roles: PASTORAL_ROLES })
      .andWhere('m.status NOT IN (:...statuses)', { statuses: PASTORAL_STATUSES })
      .getMany();

    if (mismatched.length === 0) return { fixed: 0 };

    await this.repo
      .createQueryBuilder()
      .update(Member)
      .set({ status: MemberStatus.PASTOR })
      .where('id IN (:...ids)', { ids: mismatched.map((m) => m.id) })
      .execute();

    return { fixed: mismatched.length };
  }

  // ── softDelete ────────────────────────────────────────────────────────────
  async softDelete(id: string, churchId: string) {
    await this.repo.softDelete({ id, churchId });
  }

  // ── _generateMemberId ─────────────────────────────────────────────────────
  private async _generateMemberId(churchId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repo.count({ where: { churchId } });
    return `KP-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
