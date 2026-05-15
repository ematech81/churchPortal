import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Church } from './church.entity';
import { Member } from '../members/member.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '@/types';
import { CreateChurchDto } from './dto/create-church.dto';

@Injectable()
export class ChurchesService {
  constructor(
    @InjectRepository(Church) private readonly repo: Repository<Church>,
    @InjectRepository(Member) private readonly memberRepo: Repository<Member>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string) {
    const church = await this.findById(id);
    if (!church) throw new NotFoundException('Church not found');
    return church;
  }

  create(data: Partial<Church>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Church>) {
    await this.repo.update(id, data as any);
    return this.findByIdOrFail(id);
  }

  async createForUser(userId: string, dto: CreateChurchDto) {
    const slug = this._slugify(dto.name);
    const role = dto.parentChurchId ? UserRole.BRANCH_PASTOR : UserRole.SENIOR_PASTOR;

    const church = await this.create({
      name: dto.name, slug,
      denomination: dto.denomination ?? null,
      address: dto.address ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      logoUrl: dto.logoUrl ?? null,
      parentChurchId: dto.parentChurchId ?? null,
    });

    await this.usersService.setChurchAndRole(userId, church.id, role);
    const user = await this.usersService.findById(userId);
    const tokens = await this.authService.issueTokens(user!);
    return { church, ...tokens };
  }

  async createBranch(parentChurchId: string, dto: { name: string; address?: string; city?: string; phone?: string }) {
    const slug = this._slugify(dto.name);
    return this.create({
      name: dto.name, slug,
      address: dto.address ?? null,
      city: dto.city ?? null,
      phone: dto.phone ?? null,
      parentChurchId,
    });
  }

  listBranches(parentChurchId: string) {
    return this.repo.find({ where: { parentChurchId }, order: { name: 'ASC' } });
  }

  async listBranchesWithStats(parentChurchId: string) {
    const branches = await this.listBranches(parentChurchId);
    if (!branches.length) return [];

    const ids = branches.map((b) => b.id);

    // Batch: member count per branch
    const memberCounts = await this.memberRepo
      .createQueryBuilder('m')
      .select('m.churchId', 'churchId')
      .addSelect('COUNT(m.id)', 'count')
      .where('m.churchId IN (:...ids)', { ids })
      .groupBy('m.churchId')
      .getRawMany();

    const countMap = new Map(memberCounts.map((r) => [r.churchId, parseInt(r.count, 10)]));

    // Batch: worker count per branch
    const workerCounts = await this.memberRepo
      .createQueryBuilder('m')
      .select('m.churchId', 'cid')
      .addSelect('COUNT(m.id)', 'cnt')
      .where('m.churchId IN (:...ids) AND m.status = :status', { ids, status: 'worker' })
      .groupBy('m.churchId')
      .getRawMany();

    const workerMap = new Map(workerCounts.map((r) => [r.cid, parseInt(r.cnt, 10)]));

    // Batch: one pastor per branch
    const pastors = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.phone', 'u.churchId', 'u.avatarUrl'])
      .where('u.churchId IN (:...ids) AND u.role = :role', { ids, role: UserRole.BRANCH_PASTOR })
      .getMany();

    const pastorMap = new Map(pastors.map((p) => [p.churchId!, p]));

    return branches.map((b) => ({
      ...b,
      memberCount: countMap.get(b.id) ?? 0,
      workerCount: workerMap.get(b.id) ?? 0,
      pastor: pastorMap.get(b.id) ?? null,
    }));
  }

  async getBranchPastors(parentChurchId: string) {
    const branchIds = await this.getBranchIds(parentChurchId);
    if (branchIds.length === 0) return [];

    return this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.phone', 'u.churchId', 'u.role', 'u.avatarUrl'])
      .where('u.churchId IN (:...ids) AND u.role = :role', { ids: branchIds, role: UserRole.BRANCH_PASTOR })
      .orderBy('u.firstName', 'ASC')
      .getMany();
  }

  async updateBranch(id: string, parentChurchId: string, data: Partial<Church>) {
    const branch = await this.repo.findOne({ where: { id, parentChurchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    await this.repo.update(id, data as any);
    return this.findByIdOrFail(id);
  }

  async deleteBranch(id: string, parentChurchId: string) {
    const branch = await this.repo.findOne({ where: { id, parentChurchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const memberCount = await this.memberRepo.count({ where: { churchId: id } });
    if (memberCount > 0) {
      throw new BadRequestException(
        `Cannot delete a branch with ${memberCount} member(s). Reassign members first.`,
      );
    }

    await this.repo.remove(branch);
  }

  async assignPastorToBranch(parentChurchId: string, pastorId: string, branchId: string) {
    const branchIds = await this.getBranchIds(parentChurchId);
    if (!branchIds.includes(branchId)) throw new NotFoundException('Branch not found');

    const pastor = await this.userRepo.findOne({ where: { id: pastorId } });
    if (!pastor) throw new NotFoundException('Pastor not found');

    await this.userRepo.update(pastorId, { churchId: branchId } as any);
    const branch = await this.repo.findOne({ where: { id: branchId } });
    return { success: true, branchName: branch?.name };
  }

  async getBranchIds(parentChurchId: string): Promise<string[]> {
    const branches = await this.repo.find({ where: { parentChurchId } });
    return [parentChurchId, ...branches.map((b) => b.id)];
  }

  private _slugify(name: string): string {
    return (
      name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
      '-' + Date.now().toString(36)
    );
  }
}
