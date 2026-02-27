"use client";

import { Fragment, useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { format, isToday, isMonday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { UserCircle2, CalendarOff, Check, Send, XCircle, Move, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildInitialsMap } from "@/lib/utils/initials";
import { ROLE_TAG, VIRTUAL_SITE_SURGERY } from "@/lib/constants";
import { weekSepStyle } from "@/lib/utils/planning-helpers";
import type { LeaveEntry } from "@/lib/types/planning-views";

import { useMoveAssignment, useMoveDoctorSchedule, useCancelAssignment, useUpdateAssignmentStatus } from "@/hooks/use-assignments";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { QuickAbsenceDialog } from "@/components/dialogs/quick-absence-dialog";
import { AssignmentDialog } from "@/components/dialogs/assignment-dialog";
import { MoveAssignmentDialog } from "@/components/dialogs/move-assignment-dialog";
import { SwapAssignmentDialog } from "@/components/dialogs/swap-assignment-dialog";
import { SurgeryAssignmentDialog } from "@/components/dialogs/surgery-assignment-dialog";
import type {
  PlanningSite,
  PlanningBlock,
  StaffingNeed,
  AssignmentStatus,
  AssignmentSource,
} from "@/lib/types/database";

/** Fixed width for the first column */
const COL1 = "w-[180px] min-w-[180px] max-w-[180px]";
const COL1_SHADOW = "2px 0 0 0 #cbd5e1";

interface DepartmentsTableViewProps {
  days: string[];
  sites: PlanningSite[];
  leaves?: LeaveEntry[];
}

/** Merged person for a day: AM, PM, or FULL — enriched for DnD + actions */
interface DayPerson {
  id_staff: number;
  firstname: string;
  lastname: string;
  type: "DOCTOR" | "SECRETARY";
  id_primary_position: 1 | 2 | 3;
  period: "AM" | "PM" | "FULL";
  roleId: number | null;
  skillId: number | null;
  activityId: number | null;
  // For actions + DnD
  id_assignment: number;
  id_block: number;
  status: AssignmentStatus;
  source: AssignmentSource;
  // For FULL day: PM-side ids (AM is the primary)
  pm_id_assignment?: number;
  pm_id_block?: number;
}

/** Drag data attached to draggable chips */
export interface ChipDragData {
  personId: number;
  personType: "DOCTOR" | "SECRETARY";
  personName: string;
  idPrimaryPosition: 1 | 2 | 3;
  date: string;
  deptId: number;
  deptName: string;
  period: "AM" | "PM" | "FULL";
  assignmentId: number;
  pmAssignmentId?: number;
  activityId: number | null;
  roleId: number | null;
  skillId: number | null;
}

/** Pending assignment dialog data */
interface PendingAssignDialog {
  dragData: ChipDragData;
  dropData: CellDropData;
}

/** Drop data attached to droppable cells */
export interface CellDropData {
  deptId: number;
  deptName: string;
  date: string;
  amBlocks: PlanningBlock[];
  pmBlocks: PlanningBlock[];
  amNeeds: StaffingNeed[];
  pmNeeds: StaffingNeed[];
}

function mergeAssignments(amBlocks: PlanningBlock[], pmBlocks: PlanningBlock[]): DayPerson[] {
  const map = new Map<number, DayPerson>();

  for (const block of amBlocks) {
    for (const a of block.assignments) {
      map.set(a.id_staff, {
        id_staff: a.id_staff,
        firstname: a.firstname,
        lastname: a.lastname,
        type: a.assignment_type as "DOCTOR" | "SECRETARY",
        id_primary_position: a.id_primary_position,
        period: "AM",
        roleId: a.id_role,
        skillId: a.id_skill,
        activityId: a.id_activity,
        id_assignment: a.id_assignment,
        id_block: block.id_block,
        status: a.status,
        source: a.source,
      });
    }
  }

  for (const block of pmBlocks) {
    for (const a of block.assignments) {
      const existing = map.get(a.id_staff);
      if (existing) {
        existing.period = "FULL";
        existing.pm_id_assignment = a.id_assignment;
        existing.pm_id_block = block.id_block;
      } else {
        map.set(a.id_staff, {
          id_staff: a.id_staff,
          firstname: a.firstname,
          lastname: a.lastname,
          type: a.assignment_type as "DOCTOR" | "SECRETARY",
          id_primary_position: a.id_primary_position,
          period: "PM",
          roleId: a.id_role,
          skillId: a.id_skill,
          activityId: a.id_activity,
          id_assignment: a.id_assignment,
          id_block: block.id_block,
          status: a.status,
          source: a.source,
        });
      }
    }
  }

  return Array.from(map.values());
}

export function DepartmentsTableView({ days, sites, leaves = [] }: DepartmentsTableViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();


  const moveAssignment = useMoveAssignment();
  const moveDoctorSchedule = useMoveDoctorSchedule();
  const cancelAssignment = useCancelAssignment();
  const updateStatus = useUpdateAssignmentStatus();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Active drag state for DragOverlay
  const [activeDrag, setActiveDrag] = useState<{
    person: DayPerson;
    initials: string;
  } | null>(null);

  // Chip action menu state
  const [chipMenu, setChipMenu] = useState<{
    person: DayPerson;
    date: string;
    deptId: number;
    deptName: string;
    anchor: DOMRect;
  } | null>(null);

  // Dialog states
  const [quickAbsence, setQuickAbsence] = useState<{
    staffId: number; staffName: string; date: string; period: "AM" | "PM" | "FULL";
  } | null>(null);
  const [moveDialog, setMoveDialog] = useState<{
    person: DayPerson; date: string; deptId: number; deptName: string;
  } | null>(null);
  const [swapDialog, setSwapDialog] = useState<{
    person: DayPerson; date: string; deptId: number; deptName: string;
  } | null>(null);

  // Assignment dialog: full modal for period + role/skill selection
  const [assignDialog, setAssignDialog] = useState<PendingAssignDialog | null>(null);

  // Admin confirm: simple period picker for FULL-day drops on admin departments
  const [adminConfirm, setAdminConfirm] = useState<PendingAssignDialog | null>(null);

  // Surgery dialog: opened directly on drop when target is surgery
  const [surgeryDialog, setSurgeryDialog] = useState<{
    dragData: ChipDragData;
    dropData: CellDropData;
  } | null>(null);

  // Surgery view dialog: opened by clicking on a surgery cell (view/manage mode)
  const [surgeryView, setSurgeryView] = useState<{
    date: string;
    deptName: string;
    amBlocks: PlanningBlock[];
    pmBlocks: PlanningBlock[];
    amNeeds: StaffingNeed[];
    pmNeeds: StaffingNeed[];
  } | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayIndex = days.indexOf(todayStr);
    if (todayIndex >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, (todayIndex - 2) * 140);
    }
  }, [days]);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as ChipDragData | undefined;
    if (!data) return;
    setActiveDrag({
      person: {
        id_staff: data.personId,
        firstname: data.personName.split(" ")[0] ?? "",
        lastname: data.personName.split(" ").slice(1).join(" ") ?? "",
        type: data.personType,
        id_primary_position: data.idPrimaryPosition,
        period: data.period,
        roleId: data.roleId,
        skillId: data.skillId,
        activityId: data.activityId,
        id_assignment: data.assignmentId,
        id_block: 0,
        status: "PUBLISHED",
        source: "MANUAL",
      },
      initials: "", // will be resolved in overlay
    });
  };

  /** Move a single assignment to the target cell */
  const executeMoveOne = (
    assignmentId: number,
    period: "AM" | "PM",
    dragData: ChipDragData,
    dropData: CellDropData,
    linkedDoctorId?: number | null,
  ) => {
    // Resolve real department ID from blocks (virtual depts like Administration use id_dept=-2000
    // but the actual work_blocks have the real id_department)
    const periodBlocks = period === "PM" ? dropData.pmBlocks : dropData.amBlocks;
    const realDeptId = periodBlocks[0]?.id_department ?? dropData.deptId;

    // Doctor → write directly into assignments (CANCEL old + INSERT new MANUAL)
    if (dragData.personType === "DOCTOR") {
      moveDoctorSchedule.mutate({
        staffId: dragData.personId,
        sourceAssignmentId: assignmentId,
        targetDeptId: realDeptId,
        targetDate: dropData.date,
        period,
        activityId: dragData.activityId,
        personName: dragData.personName,
        idPrimaryPosition: dragData.idPrimaryPosition,
      });
      return;
    }

    // Secretary → atomic RPC: cancel old + find block + upsert new
    moveAssignment.mutate({
      oldAssignmentId: assignmentId,
      targetDeptId: realDeptId,
      targetDate: dropData.date,
      period,
      staffId: dragData.personId,
      roleId: dragData.roleId,
      skillId: dragData.skillId,
      linkedDoctorId: linkedDoctorId ?? null,
      personName: dragData.personName,
      idPrimaryPosition: dragData.idPrimaryPosition,
    });
  };

  /** Execute a confirmed drop from the unified popover */
  const executeConfirmedDrop = (
    dragData: ChipDragData,
    dropData: CellDropData,
    period: "AM" | "PM",
    assignmentId: number,
    roleId: number | null,
    skillId: number | null,
    linkedDoctorId: number | null,
  ) => {
    executeMoveOne(
      assignmentId,
      period,
      { ...dragData, roleId, skillId },
      dropData,
      linkedDoctorId,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as ChipDragData | undefined;
    const dropData = over.data.current as CellDropData | undefined;
    if (!dragData || !dropData) return;

    // Don't move to same cell
    if (dragData.deptId === dropData.deptId && dragData.date === dropData.date) return;

    // No blocks in destination — skip
    if (dropData.amBlocks.length === 0 && dropData.pmBlocks.length === 0) return;

    // Don't drop doctors on ADMIN blocks
    const allBlocks = [...dropData.amBlocks, ...dropData.pmBlocks];
    if (dragData.personType === "DOCTOR" && allBlocks.every((b) => b.block_type === "ADMIN")) return;

    // Surgery target → open full surgery dialog directly
    const hasSurgery = allBlocks.some((b) => b.block_type === "SURGERY");
    if (hasSurgery && dragData.personType === "SECRETARY") {
      setSurgeryDialog({ dragData, dropData });
      return;
    }

    // Admin target → no role/skill dialog needed
    const isAdmin = allBlocks.every((b) => b.block_type === "ADMIN");
    if (isAdmin) {
      const hasAm = dropData.amBlocks.length > 0;
      const hasPm = dropData.pmBlocks.length > 0;

      if (dragData.period === "FULL" && dragData.pmAssignmentId && hasAm && hasPm) {
        // FULL day person + target has both periods → ask which period
        setAdminConfirm({ dragData, dropData });
      } else {
        // Single period or target has only one period → execute immediately
        const period = !hasAm ? "PM" as const : !hasPm ? "AM" as const : dragData.period === "PM" ? "PM" as const : "AM" as const;
        const assignmentId = period === "PM" && dragData.pmAssignmentId
          ? dragData.pmAssignmentId
          : dragData.assignmentId;
        executeConfirmedDrop(dragData, dropData, period, assignmentId, 1, null, null);
      }
      return;
    }

    // Otherwise open assignment dialog
    setAssignDialog({ dragData, dropData });
  };

  // Build leave index: date → list of { staff info, period }
  const leavesByDay = useMemo(() => {
    const index = new Map<string, { id_staff: number; firstname: string; lastname: string; position: number; period: "AM" | "PM" | null }[]>();
    for (const leave of leaves) {
      if (!leave.staff) continue;
      for (const d of days) {
        if (d >= leave.start_date && d <= leave.end_date) {
          if (!index.has(d)) index.set(d, []);
          const existing = index.get(d)!;
          const alreadyExists = existing.find((e) => e.id_staff === leave.id_staff);
          if (alreadyExists) {
            if (leave.period === null || (alreadyExists.period !== null && alreadyExists.period !== leave.period)) {
              alreadyExists.period = null;
            }
          } else {
            existing.push({
              id_staff: leave.id_staff,
              firstname: leave.staff.firstname,
              lastname: leave.staff.lastname,
              position: leave.staff.id_primary_position,
              period: leave.period,
            });
          }
        }
      }
    }
    return index;
  }, [leaves, days]);

  const hasLeaves = leaves.length > 0;

  // Build disambiguated initials map from all staff across sites + leaves
  const initialsMap = useMemo(() => {
    const allPeople: { id_staff: number; firstname: string; lastname: string }[] = [];
    const seen = new Set<number>();
    for (const site of sites) {
      for (const dept of site.departments) {
        for (const day of dept.days) {
          for (const period of [day.am, day.pm]) {
            for (const block of period.blocks) {
              for (const a of block.assignments) {
                if (!seen.has(a.id_staff)) {
                  seen.add(a.id_staff);
                  allPeople.push({ id_staff: a.id_staff, firstname: a.firstname, lastname: a.lastname });
                }
              }
            }
          }
        }
      }
    }
    for (const leave of leaves) {
      if (leave.staff && !seen.has(leave.id_staff)) {
        seen.add(leave.id_staff);
        allPeople.push({ id_staff: leave.id_staff, firstname: leave.staff.firstname, lastname: leave.staff.lastname });
      }
    }
    return buildInitialsMap(allPeople);
  }, [sites, leaves]);

  // Precompute week boundaries + week parity for zebra striping
  const weekStartSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < days.length; i++) {
      const date = parseISO(days[i]);
      if (isMonday(date) || i === 0) set.add(days[i]);
    }
    return set;
  }, [days]);

  // Build chip menu actions
  const chipMenuSections = useMemo(() => {
    if (!chipMenu) return [];
    const { person, date, deptId, deptName } = chipMenu;

    const mainItems = [
      {
        label: "Voir le profil",
        icon: UserCircle2,
        onClick: () => router.push(`/staff/${person.id_staff}`),
      },
      {
        label: "Déclarer absence",
        icon: CalendarOff,
        onClick: () => setQuickAbsence({
          staffId: person.id_staff,
          staffName: `${person.firstname} ${person.lastname}`,
          date,
          period: person.period,
        }),
      },
      {
        label: "Déplacer",
        icon: Move,
        onClick: () => setMoveDialog({ person, date, deptId, deptName }),
      },
      {
        label: "Échanger",
        icon: ArrowLeftRight,
        onClick: () => setSwapDialog({ person, date, deptId, deptName }),
      },
    ];

    const statusItems = [];
    if (person.status === "PROPOSED") {
      statusItems.push({
        label: "Confirmer",
        icon: Check,
        onClick: () =>
          updateStatus.mutate({ id_assignment: person.id_assignment, status: "CONFIRMED" as const }),
      });
    }
    if (person.status === "CONFIRMED") {
      statusItems.push({
        label: "Publier",
        icon: Send,
        onClick: () =>
          updateStatus.mutate({ id_assignment: person.id_assignment, status: "PUBLISHED" as const }),
      });
    }

    const dangerItems = [];
    if (person.status !== "CANCELLED" && person.status !== "INVALIDATED") {
      dangerItems.push({
        label: "Annuler assignation",
        icon: XCircle,
        variant: "danger" as const,
        onClick: () =>
          cancelAssignment.mutate({ assignmentId: person.id_assignment }),
      });
    }

    const sections = [{ items: [...mainItems, ...statusItems] }];
    if (dangerItems.length > 0) {
      sections.push({ items: dangerItems });
    }
    return sections;
  }, [chipMenu, router, updateStatus, cancelAssignment]);

  if (sites.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune donnée pour ce mois
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        ref={scrollRef}
        className="overflow-auto max-h-full rounded-xl border border-slate-200 bg-white shadow-md"
      >
        <table className="border-collapse w-max">
          <thead className="sticky top-0 z-30">
            <tr>
              <th
                className={cn(
                  "sticky left-0 z-40 bg-slate-50 border-b border-b-slate-200 px-4 py-2.5 text-left",
                  COL1
                )}
                style={{ boxShadow: COL1_SHADOW }}
              >
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Département
                </span>
              </th>
              {days.map((dateStr, dayIdx) => {
                const date = parseISO(dateStr);
                const isWkStart = weekStartSet.has(dateStr);
                const today = isToday(date);


                return (
                  <th
                    key={dateStr}
                    className={cn(
                      "px-1 py-2 text-center min-w-[130px] border-b border-r border-slate-200 bg-white",
                      today && "bg-sky-50 border-b-2 border-b-sky-400"
                    )}
                    style={weekSepStyle(isWkStart, dayIdx === 0)}
                  >
                    <div className="text-[10px] uppercase text-slate-400 font-medium tracking-wide">
                      {format(date, "EEE", { locale: fr })}
                    </div>
                    <div className={cn(
                      "text-lg font-bold tabular-nums",
                      today ? "text-sky-600" : "text-slate-700"
                    )}>
                      {format(date, "d")}
                    </div>
                    <div className="text-[9px] text-slate-400">
                      {format(date, "MMM", { locale: fr })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {(() => {
              let globalRowIdx = 0;
              return sites.map((site) => {
                const isSurgerySite = site.id_site === VIRTUAL_SITE_SURGERY;

                return (
                <Fragment key={`site-${site.id_site}`}>
                  {site.departments.map((dept) => {
                    const isEvenRow = globalRowIdx % 2 === 0;
                    globalRowIdx++;
                    const stickyBg = isEvenRow ? "bg-white" : "bg-slate-50";

                    return (
                      <tr
                        key={`dept-${dept.id_department}`}
                        className={cn("border-b border-slate-200", stickyBg)}
                      >
                        <td className={cn(
                          "sticky left-0 z-10 px-3 py-1.5",
                          COL1,
                          stickyBg
                        )} style={{ boxShadow: COL1_SHADOW }}>
                          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-tight">
                            {site.name}
                          </div>
                          <div className="text-[13px] font-semibold text-slate-700 whitespace-nowrap leading-tight">
                            {dept.name}
                          </div>
                        </td>

                        {dept.days.map((day, dayIdx) => {
                          const date = parseISO(day.date);
                          const isWkStart = weekStartSet.has(day.date);
                          const today = isToday(date);

                          const merged = mergeAssignments(day.am.blocks, day.pm.blocks);
                          const needs = [...day.am.needs, ...day.pm.needs];

                          return (
                            <td
                              key={day.date}
                              className={cn(
                                "px-1.5 py-1.5 border-b border-r border-slate-200 h-1",
                                today && "bg-sky-50"
                              )}
                              style={weekSepStyle(isWkStart, dayIdx === 0)}
                            >
                              <DroppableCell
                                deptId={dept.id_department}
                                deptName={dept.name}
                                date={day.date}
                                amBlocks={day.am.blocks}
                                pmBlocks={day.pm.blocks}
                                amNeeds={day.am.needs}
                                pmNeeds={day.pm.needs}
                              >
                                <DayCard
                                  people={merged}
                                  needs={needs}
                                  initialsMap={initialsMap}
                                  date={day.date}
                                  deptId={dept.id_department}
                                  deptName={dept.name}
                                  onChipClick={(person, anchor) =>
                                    setChipMenu({ person, date: day.date, deptId: dept.id_department, deptName: dept.name, anchor })
                                  }
                                  onCellAreaClick={isSurgerySite ? () => setSurgeryView({
                                    date: day.date,
                                    deptName: dept.name,
                                    amBlocks: day.am.blocks,
                                    pmBlocks: day.pm.blocks,
                                    amNeeds: day.am.needs,
                                    pmNeeds: day.pm.needs,
                                  }) : undefined}
                                />
                              </DroppableCell>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
                );
              })
            })()}

            {/* Absences row */}
            {hasLeaves && (
              <tr className="border-b border-slate-200">
                <td className={cn(
                  "sticky left-0 z-10 px-3 py-1.5 bg-white",
                  COL1
                )} style={{ boxShadow: COL1_SHADOW }}>
                  <div className="text-[10px] font-medium text-red-400 uppercase tracking-wide leading-tight">
                    Absences
                  </div>
                  <div className="text-[13px] font-semibold text-slate-700 whitespace-nowrap leading-tight">
                    Personnel absent
                  </div>
                </td>
                {days.map((dateStr, dayIdx) => {
                  const date = parseISO(dateStr);
                  const isWkStart = weekStartSet.has(dateStr);
                  const today = isToday(date);
                  const dayLeaves = leavesByDay.get(dateStr) ?? [];

                  return (
                    <td
                      key={dateStr}
                      className={cn(
                        "px-1.5 py-1.5 align-top border-b border-r border-slate-200",
                        today && "bg-sky-50"
                      )}
                      style={weekSepStyle(isWkStart, dayIdx === 0)}
                    >
                      <AbsenceCard leaves={dayLeaves} initialsMap={initialsMap} />
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drag overlay — floating chip follows cursor */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <OverlayChip person={activeDrag.person} initialsMap={initialsMap} />
        )}
      </DragOverlay>

      {/* Chip action menu */}
      <DropdownMenu
        sections={chipMenuSections}
        header={
          chipMenu && (
            <p className="text-xs font-semibold text-slate-500 truncate">
              {chipMenu.person.firstname} {chipMenu.person.lastname}
            </p>
          )
        }
        anchor={chipMenu?.anchor ?? null}
        open={chipMenu !== null}
        onClose={() => setChipMenu(null)}
      />

      {/* Assignment dialog — full modal for period + role/skill selection */}
      {assignDialog && (
        <AssignmentDialog
          open
          onClose={() => setAssignDialog(null)}
          dragData={assignDialog.dragData}
          dropData={assignDialog.dropData}
          onConfirm={(period, assignmentId, roleId, skillId, linkedDoctorId) => {
            setAssignDialog(null);
            executeConfirmedDrop(assignDialog.dragData, assignDialog.dropData, period, assignmentId, roleId, skillId, linkedDoctorId);
          }}
          onConfirmFull={(amRoleId, amSkillId, amLinkedDoc, pmRoleId, pmSkillId, pmLinkedDoc) => {
            setAssignDialog(null);
            const { dragData, dropData } = assignDialog;
            executeConfirmedDrop(dragData, dropData, "AM", dragData.assignmentId, amRoleId, amSkillId, amLinkedDoc);
            if (dragData.pmAssignmentId) {
              executeConfirmedDrop(dragData, dropData, "PM", dragData.pmAssignmentId, pmRoleId, pmSkillId, pmLinkedDoc);
            }
          }}
          isPending={moveAssignment.isPending}
        />
      )}

      {/* Admin period picker — simple confirm for FULL-day drops on admin */}
      {adminConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in-up"
            style={{ animationDuration: "150ms" }}
            onClick={() => setAdminConfirm(null)}
          />
          <div
            className="relative bg-card rounded-2xl shadow-xl border border-border/40 w-full max-w-xs mx-4 animate-fade-in-up overflow-hidden"
            style={{ animationDuration: "200ms" }}
          >
            <div className="p-5">
              <h3 className="text-sm font-semibold text-foreground">
                {adminConfirm.dragData.personName}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {adminConfirm.dragData.deptName} → {adminConfirm.dropData.deptName}
              </p>
              {(() => {
                const hasAm = adminConfirm.dropData.amBlocks.length > 0;
                const hasPm = adminConfirm.dropData.pmBlocks.length > 0;
                const canFull = hasAm && hasPm;
                const periods = (["AM", "PM", "FULL"] as const).filter((p) =>
                  p === "AM" ? hasAm : p === "PM" ? hasPm : canFull
                );
                return (
                  <>
                    <p className="text-xs text-muted-foreground mt-2">Quelle période ?</p>
                    <div className="flex gap-2 mt-3">
                      {periods.map((p) => {
                        const label = p === "AM" ? "Matin" : p === "PM" ? "Après-midi" : "Journée";
                        return (
                          <button
                            key={p}
                            onClick={() => {
                              const { dragData, dropData } = adminConfirm;
                              setAdminConfirm(null);
                              if (p === "FULL") {
                                executeConfirmedDrop(dragData, dropData, "AM", dragData.assignmentId, 1, null, null);
                                if (dragData.pmAssignmentId) {
                                  executeConfirmedDrop(dragData, dropData, "PM", dragData.pmAssignmentId, 1, null, null);
                                }
                              } else {
                                const assignmentId = p === "PM" && dragData.pmAssignmentId
                                  ? dragData.pmAssignmentId
                                  : dragData.assignmentId;
                                executeConfirmedDrop(dragData, dropData, p, assignmentId, 1, null, null);
                              }
                            }}
                            className="flex-1 px-3 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="flex items-center justify-end px-5 py-3 border-t border-border/30 bg-muted/20">
              <button
                onClick={() => setAdminConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action dialogs */}
      {quickAbsence && (
        <QuickAbsenceDialog
          open
          onClose={() => setQuickAbsence(null)}
          staffId={quickAbsence.staffId}
          staffName={quickAbsence.staffName}
          date={quickAbsence.date}
          defaultPeriod={quickAbsence.period}
        />
      )}
      {moveDialog && (
        <MoveAssignmentDialog
          open
          onClose={() => setMoveDialog(null)}
          person={moveDialog.person}
          sourceDate={moveDialog.date}
          sourceDeptName={moveDialog.deptName}
          sites={sites}
        />
      )}
      {swapDialog && (
        <SwapAssignmentDialog
          open
          onClose={() => setSwapDialog(null)}
          personA={swapDialog.person}
          dateA={swapDialog.date}
          deptNameA={swapDialog.deptName}
          sites={sites}
        />
      )}
      {surgeryDialog && (
        <SurgeryAssignmentDialog
          open
          onClose={() => setSurgeryDialog(null)}
          onConfirm={(period, selection) => {
            const { dragData, dropData } = surgeryDialog;
            const assignmentId = period === "PM" && dragData.pmAssignmentId
              ? dragData.pmAssignmentId
              : dragData.assignmentId;
            setSurgeryDialog(null);
            executeConfirmedDrop(dragData, dropData, period, assignmentId, selection.roleId, selection.skillId, selection.linkedDoctorId);
          }}
          personName={surgeryDialog.dragData.personName}
          personPeriod={surgeryDialog.dragData.period}
          sourceDeptName={surgeryDialog.dragData.deptName}
          targetDeptName={surgeryDialog.dropData.deptName}
          amBlocks={surgeryDialog.dropData.amBlocks}
          amNeeds={surgeryDialog.dropData.amNeeds}
          pmBlocks={surgeryDialog.dropData.pmBlocks}
          pmNeeds={surgeryDialog.dropData.pmNeeds}
          isPending={moveAssignment.isPending}
        />
      )}
      {surgeryView && (
        <SurgeryAssignmentDialog
          open
          onClose={() => setSurgeryView(null)}
          personName={null}
          targetDeptName={surgeryView.deptName}
          amBlocks={surgeryView.amBlocks}
          amNeeds={surgeryView.amNeeds}
          pmBlocks={surgeryView.pmBlocks}
          pmNeeds={surgeryView.pmNeeds}
        />
      )}
    </DndContext>
  );
}

// ─── Sub-components ──────────────────────────────────────

/** Droppable wrapper for a day cell */
function DroppableCell({
  deptId,
  deptName,
  date,
  amBlocks,
  pmBlocks,
  amNeeds,
  pmNeeds,
  children,
}: {
  deptId: number;
  deptName: string;
  date: string;
  amBlocks: PlanningBlock[];
  pmBlocks: PlanningBlock[];
  amNeeds: StaffingNeed[];
  pmNeeds: StaffingNeed[];
  children: React.ReactNode;
}) {
  const cellId = `cell-${deptId}-${date}`;
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { deptId, deptName, date, amBlocks, pmBlocks, amNeeds, pmNeeds } satisfies CellDropData,
  });

  return (
    <div
      id={cellId}
      ref={setNodeRef}
      className={cn(
        "rounded-md transition-all duration-100 min-h-[28px] h-full",
        isOver && "ring-2 ring-primary/40 bg-primary/5"
      )}
    >
      {children}
    </div>
  );
}

/** Draggable chip for a person in the planning grid */
function PersonChip({
  person,
  initialsMap,
  date,
  deptId,
  deptName,
  onClick,
}: {
  person: DayPerson;
  initialsMap: Map<number, string>;
  date: string;
  deptId: number;
  deptName: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const isDoc = person.type === "DOCTOR";
  const tag = ROLE_TAG[person.roleId ?? 1];
  const initials = initialsMap.get(person.id_staff) ?? `${person.firstname[0]}${person.lastname[0]}`.toUpperCase();
  const didDragRef = useRef(false);

  const dragData: ChipDragData = {
    personId: person.id_staff,
    personType: person.type,
    personName: `${person.firstname} ${person.lastname}`,
    idPrimaryPosition: person.id_primary_position,
    date,
    deptId,
    deptName,
    period: person.period,
    assignmentId: person.id_assignment,
    pmAssignmentId: person.pm_id_assignment,
    activityId: person.activityId,
    roleId: person.roleId,
    skillId: person.skillId,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${person.id_assignment}-${date}-${person.period}`,
    data: dragData,
  });

  // Track drag to suppress click after drag-end
  useEffect(() => {
    if (isDragging) didDragRef.current = true;
  }, [isDragging]);

  const isAM = person.period === "AM";
  const isPM = person.period === "PM";

  const handleClick = (e: React.MouseEvent) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-chip
      onClick={handleClick}
      className={cn(
        "relative inline-flex items-center justify-center gap-0.5 w-[38px] h-7 rounded-lg overflow-hidden",
        "text-[11px] font-semibold leading-none",
        "transition-all duration-200",
        "cursor-grab active:cursor-grabbing",
        "focus:ring-2 focus:ring-primary/20",
        isDragging && "opacity-30 scale-95"
      )}
      style={{
        background: isDoc ? "#4A6FA5" : "#F8F9FA",
        outline: isDoc ? "1px solid rgba(0,0,0,0.1)" : "1px solid #D1D5DB",
        outlineOffset: "-1px",
      }}
      title={`${person.firstname} ${person.lastname} — ${
        person.period === "FULL" ? "Journée" : person.period === "AM" ? "Matin" : "Après-midi"
      }`}
    >
      {isAM && <span className="absolute left-0 inset-y-0 w-[3px]" style={{ background: "#eab308" }} />}
      {isPM && <span className="absolute right-0 inset-y-0 w-[3px]" style={{ background: "#d97706" }} />}
      <span style={{ color: isDoc ? "#ffffff" : "#2C3E50" }}>{initials}</span>
      {tag && (
        <span className="text-[9px] font-bold" style={{ color: isDoc ? "rgba(255,255,255,0.5)" : "rgba(44,62,80,0.4)" }}>{tag}</span>
      )}
    </button>
  );
}

/** Static chip rendered in the DragOverlay */
function OverlayChip({ person, initialsMap }: { person: DayPerson; initialsMap: Map<number, string> }) {
  const tag = ROLE_TAG[person.roleId ?? 1];
  const initials = initialsMap.get(person.id_staff) ?? `${person.firstname[0]}${person.lastname[0]}`.toUpperCase();

  const isAM = person.period === "AM";
  const isPM = person.period === "PM";

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center gap-0.5 w-[38px] h-7 rounded-lg overflow-hidden",
        "text-[11px] font-semibold leading-none cursor-grabbing",
      )}
      style={{
        background: "#f8f9fa",
        outline: "1px solid rgba(0,0,0,0.06)",
        outlineOffset: "-1px",
        boxShadow: "0 8px 24px -4px rgb(0 0 0 / 0.12), 0 2px 6px 0 rgb(0 0 0 / 0.06)",
      }}
    >
      {isAM && <span className="absolute left-0 inset-y-0 w-[3px]" style={{ background: "#eab308" }} />}
      {isPM && <span className="absolute right-0 inset-y-0 w-[3px]" style={{ background: "#d97706" }} />}
      <span style={{ color: "#2C3E50" }}>{initials}</span>
      {tag && <span className="text-[9px] font-bold" style={{ color: "rgba(44,62,80,0.4)" }}>{tag}</span>}
    </span>
  );
}

/** Absence chip for a person */
function AbsenceChip({ leave, initialsMap }: { leave: { id_staff: number; firstname: string; lastname: string; position: number; period: "AM" | "PM" | null }; initialsMap: Map<number, string> }) {
  const initials = initialsMap.get(leave.id_staff) ?? `${leave.firstname[0]}${leave.lastname[0]}`.toUpperCase();

  const isAM = leave.period === "AM";
  const isPM = leave.period === "PM";

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center w-[38px] h-7 rounded-lg overflow-hidden",
        "text-[11px] font-semibold leading-none",
        "transition-all duration-200 cursor-default",
      )}
      style={{
        background: "#f9f0f1",
        outline: "1px solid rgba(180,130,135,0.2)",
        outlineOffset: "-1px",
        color: "#a8a29e",
      }}
      title={`${leave.firstname} ${leave.lastname} — Absent${
        leave.period === null ? " (Journée)" : leave.period === "AM" ? " (Matin)" : " (Après-midi)"
      }`}
    >
      {isAM && <span className="absolute left-0 inset-y-0 w-[3px]" style={{ background: "#eab308" }} />}
      {isPM && <span className="absolute right-0 inset-y-0 w-[3px]" style={{ background: "#d97706" }} />}
      {initials}
    </span>
  );
}

/** Day cell content: chips grouped by type with subtle divider */
function DayCard({
  people,
  needs = [],
  initialsMap,
  date,
  deptId,
  deptName,
  onChipClick,
  onCellAreaClick,
}: {
  people: DayPerson[];
  needs?: StaffingNeed[];
  initialsMap: Map<number, string>;
  date: string;
  deptId: number;
  deptName: string;
  onChipClick?: (person: DayPerson, anchor: DOMRect) => void;
  onCellAreaClick?: () => void;
}) {
  const totalGap = needs.reduce((sum, n) => sum + Math.max(0, n.gap), 0);

  if (people.length === 0 && totalGap === 0) {
    return <div className="min-h-[28px]" />;
  }

  const doctors = people.filter((p) => p.type === "DOCTOR");
  const secretaries = people.filter((p) => p.type === "SECRETARY");

  // Build gap tooltip lines
  const gapLines = needs.filter((n) => n.gap > 0).map((n) => {
    const role = n.role_name ? ` (${n.role_name})` : "";
    return `${n.gap} × ${n.skill_name}${role} — ${n.period}`;
  });

  const handleChipClick = (person: DayPerson) => (e: React.MouseEvent) => {
    // Only open menu if not dragging (dnd-kit handles distance threshold)
    const rect = e.currentTarget.getBoundingClientRect();
    onChipClick?.(person, rect);
  };

  const handleAreaClick = onCellAreaClick
    ? (e: React.MouseEvent) => {
        // Don't intercept clicks on chips (which have data-chip attribute)
        if ((e.target as HTMLElement).closest("[data-chip]")) return;
        onCellAreaClick();
      }
    : undefined;

  return (
    <div
      className={cn("relative group/card", onCellAreaClick && "cursor-pointer")}
      onClick={handleAreaClick}
    >
      {totalGap > 0 && (
        <span
          className="absolute -top-1 -right-0.5 z-10 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white"
          title={gapLines.join("\n")}
        />
      )}
      <div className="flex flex-col gap-0.5 min-h-[28px]">
        {doctors.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center max-w-[140px]">
            {doctors.map((p) => (
              <PersonChip
                key={`${p.id_staff}-${p.period}`}
                person={p}
                initialsMap={initialsMap}
                date={date}
                deptId={deptId}
                deptName={deptName}
                onClick={handleChipClick(p)}
              />
            ))}
          </div>
        )}
        {doctors.length > 0 && secretaries.length > 0 && (
          <div className="h-px bg-slate-200/60 mx-1" />
        )}
        {secretaries.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center max-w-[140px]">
            {secretaries.map((p) => (
              <PersonChip
                key={`${p.id_staff}-${p.period}`}
                person={p}
                initialsMap={initialsMap}
                date={date}
                deptId={deptId}
                deptName={deptName}
                onClick={handleChipClick(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/card:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        {doctors.length > 0 && (
          <div>
            <div className="text-sky-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Médecins</div>
            {doctors.map((p) => (
              <div key={p.id_staff} className="text-sm">
                {p.firstname} {p.lastname}
                <span className="text-slate-400 ml-1.5">
                  {p.period === "FULL" ? "Journée" : p.period === "AM" ? "Matin" : "Après-midi"}
                </span>
              </div>
            ))}
          </div>
        )}
        {doctors.length > 0 && secretaries.length > 0 && (
          <div className="border-t border-slate-600 my-1" />
        )}
        {secretaries.length > 0 && (
          <div>
            <div className="text-emerald-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Secrétaires</div>
            {secretaries.map((p) => {
              const tag = ROLE_TAG[p.roleId ?? 1];
              return (
                <div key={p.id_staff} className="text-sm">
                  {p.firstname} {p.lastname}
                  {tag && <span className="text-slate-500 ml-1">({tag})</span>}
                  <span className="text-slate-400 ml-1.5">
                    {p.period === "FULL" ? "Journée" : p.period === "AM" ? "Matin" : "Après-midi"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {gapLines.length > 0 && (
          <>
            {(doctors.length > 0 || secretaries.length > 0) && (
              <div className="border-t border-slate-600 my-1" />
            )}
            <div>
              <div className="text-red-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Manques</div>
              {gapLines.map((line, i) => (
                <div key={i} className="text-sm text-red-200">{line}</div>
              ))}
            </div>
          </>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

/** Compact card for absent staff in a day */
function AbsenceCard({ leaves, initialsMap }: { leaves: { id_staff: number; firstname: string; lastname: string; position: number; period: "AM" | "PM" | null }[]; initialsMap: Map<number, string> }) {
  if (leaves.length === 0) {
    return <div className="min-h-[28px]" />;
  }

  return (
    <div className="relative group/abs">
      <div className="flex flex-wrap gap-1 items-center min-h-[28px]">
        {leaves.map((l) => (
          <AbsenceChip key={l.id_staff} leave={l} initialsMap={initialsMap} />
        ))}
      </div>

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-xl opacity-0 pointer-events-none group-hover/abs:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
        <div className="text-red-300 font-semibold text-[10px] uppercase tracking-wide mb-0.5">Absents</div>
        {leaves.map((l) => (
          <div key={l.id_staff} className="text-sm">
            {l.firstname} {l.lastname}
            <span className="text-slate-400 ml-1.5">
              {l.period === null ? "Journée" : l.period === "AM" ? "Matin" : "Après-midi"}
            </span>
          </div>
        ))}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}
