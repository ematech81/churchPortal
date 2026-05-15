import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindManyOptions } from 'typeorm';
import { Member } from './member.entity';
import { MemberStatus } from '@/types';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member)
    private readonly repo: Repository<Member>,
  ) {}

  async findAll(churchId: string, search?: string, status?: string, limit = 100) {
    const take = Math.min(limit, 500);
    const statusFilter = status && status !== 'all' ? (status as MemberStatus) : undefined;

    if (search) {
      const base = { churchId, ...(statusFilter ? { status: statusFilter } : {}) };
      return this.repo.find({
        where: [
          { ...base, firstName: ILike(`%${search}%`) },
          { ...base, lastName: ILike(`%${search}%`) },
          { ...base, phone: ILike(`%${search}%`) },
          { ...base, email: ILike(`%${search}%`) },
          { ...base, memberId: ILike(`%${search}%`) },
        ],
        order: { firstName: 'ASC' },
        take,
      });
    }

    const where: FindManyOptions<Member>['where'] = {
      churchId,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    return this.repo.find({ where, order: { firstName: 'ASC' }, take });
  }

  count(churchId: string, status?: string) {
    const statusFilter = status && status !== 'all' ? (status as MemberStatus) : undefined;
    return this.repo.count({ where: { churchId, ...(statusFilter ? { status: statusFilter } : {}) } });
  }

  async findByIdOrFail(id: string, churchId: string) {
    const member = await this.repo.findOne({ where: { id, churchId } });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async create(churchId: string, data: Partial<Member>) {
    const memberId = await this._generateMemberId(churchId);
    return this.repo.save(this.repo.create({ ...data, churchId, memberId }));
  }

  async update(id: string, churchId: string, data: Partial<Member>) {
    await this.repo.update({ id, churchId }, data as any);
    return this.findByIdOrFail(id, churchId);
  }

  async softDelete(id: string, churchId: string) {
    await this.repo.softDelete({ id, churchId });
  }

  private async _generateMemberId(churchId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repo.count({ where: { churchId } });
    return `KP-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
