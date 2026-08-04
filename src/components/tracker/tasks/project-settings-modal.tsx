"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, ArrowLeft, ChevronLeft, ChevronRight, Lock, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  PROJECT_SETTINGS_SEED,
  ROLE_WEIGHT,
  type ProjectBusinessRole,
  type ProjectDraft,
  type ProjectMember,
  type SystemMember,
} from "@/components/tracker/tasks/project-settings-demo-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectDescriptionEditor } from "@/components/tracker/tasks/project-description-editor";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ProjectSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ModalView = "main" | "members";

const PAGE_SIZE = 5;

type UnifiedRow =
  | { kind: "system"; data: SystemMember }
  | { kind: "member"; data: ProjectMember };

const sortByRole = (a: ProjectMember, b: ProjectMember) => ROLE_WEIGHT[a.businessRole] - ROLE_WEIGHT[b.businessRole];

export const ProjectSettingsModal = ({ open, onOpenChange }: ProjectSettingsModalProps) => {
  const [currentView, setCurrentView] = useState<ModalView>("main");
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(PROJECT_SETTINGS_SEED.project);
  const [members, setMembers] = useState<ProjectMember[]>(() => [...PROJECT_SETTINGS_SEED.members].sort(sortByRole));
  const [availableUsers, setAvailableUsers] = useState(PROJECT_SETTINGS_SEED.availableUsers);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [lastAddedMemberId, setLastAddedMemberId] = useState<string | null>(null);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const addSearchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const updateDropdownPos = useCallback(() => {
    if (!addButtonRef.current) return;
    const rect = addButtonRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.right - 256 });
  }, []);

  const currentSpace = useMemo(
    () => PROJECT_SETTINGS_SEED.spaces.find((space) => space.id === projectDraft.spaceId) ?? PROJECT_SETTINGS_SEED.spaces[0],
    [projectDraft.spaceId],
  );
  const systemMembers = useMemo(
    () => PROJECT_SETTINGS_SEED.systemMembersBySpaceId[projectDraft.spaceId] ?? [],
    [projectDraft.spaceId],
  );
  const hasProjectNameError = projectDraft.name.trim().length === 0;

  const unifiedRows = useMemo<UnifiedRow[]>(() => {
    const sysRows: UnifiedRow[] = systemMembers.map((sm) => ({ kind: "system", data: sm }));
    const memberRows: UnifiedRow[] = members.map((m) => ({ kind: "member", data: m }));
    return [...sysRows, ...memberRows];
  }, [systemMembers, members]);

  const filteredAvailableUsers = useMemo(() => {
    const query = addSearchQuery.toLowerCase().trim();
    if (!query) return availableUsers;
    return availableUsers.filter((u) => u.fullName.toLowerCase().includes(query));
  }, [availableUsers, addSearchQuery]);

  useEffect(() => {
    if (!isAddDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        addDropdownRef.current?.contains(target) ||
        addButtonRef.current?.contains(target)
      ) return;
      setIsAddDropdownOpen(false);
      setAddSearchQuery("");
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAddDropdownOpen]);

  useEffect(() => {
    if (isAddDropdownOpen) {
      updateDropdownPos();
      requestAnimationFrame(() => addSearchInputRef.current?.focus());
    }
  }, [isAddDropdownOpen, updateDropdownPos]);

  useEffect(() => {
    if (!lastAddedMemberId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLButtonElement>(`[data-member-id="${lastAddedMemberId}"] [data-slot="select-trigger"]`);
      if (el) {
        el.setAttribute("data-focus-visible", "");
        el.focus();
        const handleBlur = () => {
          el.removeAttribute("data-focus-visible");
          el.removeEventListener("blur", handleBlur);
        };
        el.addEventListener("blur", handleBlur);
      }
      setLastAddedMemberId(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [lastAddedMemberId, currentPage]);

  const totalRows = unifiedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = unifiedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleProjectFieldChange = (field: keyof ProjectDraft, value: string | boolean) => {
    setProjectDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleBusinessRoleChange = (memberId: string, nextRole: string | null) => {
    if (!nextRole) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, businessRole: nextRole as ProjectBusinessRole } : m)),
    );
  };

  const handleRemoveMember = (memberId: string) => {
    const removed = members.find((m) => m.id === memberId);
    if (!removed) return;

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setAvailableUsers((prev) => [...prev, { userId: removed.userId, fullName: removed.fullName }]);
    setCurrentPage(1);
  };

  const handleAddMember = (userId: string) => {
    const selectedUser = availableUsers.find((u) => u.userId === userId);
    if (!selectedUser) return;

    const newId = `member-${crypto.randomUUID()}`;
    setMembers((prev) => [
      ...prev,
      {
        id: newId,
        userId: selectedUser.userId,
        fullName: selectedUser.fullName,
        businessRole: "Viewer" as ProjectBusinessRole,
      },
    ]);

    setAvailableUsers((prev) => prev.filter((u) => u.userId !== userId));
    // Jump to the page where the new member lands (one row is being added).
    setCurrentPage(Math.max(1, Math.ceil((systemMembers.length + members.length + 1) / PAGE_SIZE)));
    setLastAddedMemberId(newId);
    setIsAddDropdownOpen(false);
    setAddSearchQuery("");
    toast.success("Member added");
  };

  const handleGoBack = () => {
    setCurrentView("main");
    setIsAddDropdownOpen(false);
    setAddSearchQuery("");
  };

  const handleArchiveConfirm = () => {
    setProjectDraft((prev) => ({ ...prev, isArchived: true }));
    setIsArchiveConfirmOpen(false);
    toast.success("Project archived");
  };

  const handleSaveChanges = () => {
    if (hasProjectNameError) {
      toast.error("Please enter a project name.");
      return;
    }
    toast.success("Project settings saved");
    onOpenChange(false);
  };

  // ===================== VIEW: MAIN =====================

  const renderMainView = () => (
    <>
      <DialogHeader className="shrink-0 gap-1 px-4 py-3">
        <DialogTitle className="text-lg font-semibold">Edit project: {projectDraft.name}</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">Manage project details and team members.</DialogDescription>
      </DialogHeader>

      <div className="max-h-[calc(90svh-8rem)] overflow-y-auto">
        <div className="grid gap-3 px-4 pb-4">
          {/* General settings */}
          <section className="grid gap-2 rounded-xl border border-[var(--corportal-border-grey)] bg-card p-3">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Name</span>
                <Input
                  value={projectDraft.name}
                  onChange={(e) => handleProjectFieldChange("name", e.target.value)}
                  aria-label="Project name"
                  aria-invalid={hasProjectNameError}
                  placeholder="Project name"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Space</span>
                <Select
                  items={PROJECT_SETTINGS_SEED.spaces.map((space) => ({
                    value: space.id,
                    label: space.name,
                  }))}
                  value={projectDraft.spaceId}
                  onValueChange={(v) => handleProjectFieldChange("spaceId", v ?? "")}
                >
                  <SelectTrigger className="w-full" aria-label="Space">
                    <SelectValue placeholder="Space" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PROJECT_SETTINGS_SEED.spaces.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <ProjectDescriptionEditor
                value={projectDraft.description}
                onChange={(html) => handleProjectFieldChange("description", html)}
                placeholder="Add a project description…"
              />
            </div>
          </section>

          {/* Navigation to Members */}
          <nav className="grid gap-1 rounded-xl border border-[var(--corportal-border-grey)] bg-card p-1">
            <button
              type="button"
              onClick={() => setCurrentView("members")}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
              aria-label="Edit members"
            >
              <Users aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <span className="text-sm font-medium">Members</span>
                <span className="ml-2 text-xs text-muted-foreground">{totalRows}</span>
              </div>
              <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
            </button>
          </nav>
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 shrink-0 !justify-between border-t border-[var(--corportal-border-grey)] bg-card px-6 py-4">
        <Button type="button" variant="destructive" size="lg" onClick={() => setIsArchiveConfirmOpen(true)} aria-label="Archive project">
          <Archive aria-hidden className="size-4" />
          Archive
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)} aria-label="Close">
            Close
          </Button>
          <Button type="button" size="lg" onClick={handleSaveChanges} aria-label="Save changes">
            Save changes
          </Button>
        </div>
      </DialogFooter>
    </>
  );

  // ===================== VIEW: MEMBERS =====================

  const renderMembersView = () => (
    <>
      <DialogHeader className="shrink-0 gap-1 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoBack}
            className="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
            aria-label="Back to settings"
          >
            <ArrowLeft aria-hidden className="size-4" />
          </button>
          <DialogTitle className="flex-1 text-lg font-semibold">Members</DialogTitle>
        </div>
        <div className="flex items-center justify-between pl-11">
          <DialogDescription className="text-xs text-muted-foreground">Add or remove project members and assign business roles.</DialogDescription>
          <Button
            ref={addButtonRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddDropdownOpen((prev) => !prev)}
            disabled={availableUsers.length === 0}
            aria-label="Add user to project"
            aria-expanded={isAddDropdownOpen}
            className="shrink-0"
          >
            <Plus aria-hidden className="size-3.5" />
            Add
          </Button>
        </div>
      </DialogHeader>

      <div className="max-h-[calc(90svh-8rem)] overflow-y-auto px-4 pb-4">

        <div className="rounded-lg border border-[var(--corportal-border-grey)]">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[50%]" />
              <col className="w-[38%]" />
              <col className="w-[12%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 px-3 text-sm">Member</TableHead>
                <TableHead className="h-9 px-3 text-sm">Role</TableHead>
                <TableHead className="h-9 px-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row) =>
                row.kind === "system" ? (
                  <TableRow key={`sys-${row.data.id}`} className="bg-muted/30">
                    <TableCell className="px-3 py-1"><span className="inline-flex h-8 items-center text-sm text-muted-foreground">{row.data.fullName}</span></TableCell>
                    <TableCell className="px-3 py-1">
                      <span
                        className="inline-flex h-8 items-center gap-1.5 text-sm text-muted-foreground"
                        title={`Inherited from ${currentSpace?.name}`}
                      >
                        {row.data.systemRole}
                        <Lock aria-hidden className="size-3 text-muted-foreground/60" />
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-1" />
                  </TableRow>
                ) : (
                  <TableRow key={row.data.id} data-member-id={row.data.id}>
                    <TableCell className="px-3 py-1 text-sm whitespace-normal">{row.data.fullName}</TableCell>
                    <TableCell className="px-3 py-1">
                      <Select
                        items={PROJECT_SETTINGS_SEED.businessRoles.map((role) => ({
                          value: role,
                          label: role,
                        }))}
                        value={row.data.businessRole}
                        onValueChange={(v) => handleBusinessRoleChange(row.data.id, v)}
                      >
                        <SelectTrigger className="w-32" aria-label={`Role of ${row.data.fullName}`}>
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {PROJECT_SETTINGS_SEED.businessRoles.map((role) => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-3 py-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(row.data.id)}
                        aria-label={`Remove ${row.data.fullName}`}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
              {Array.from({ length: PAGE_SIZE - paginatedRows.length }, (_, i) => (
                <TableRow key={`empty-${i}`} className="pointer-events-none hover:bg-transparent border-b-transparent">
                  <TableCell className="px-3 py-1"><span className="invisible inline-flex h-8 items-center">—</span></TableCell>
                  <TableCell className="px-3 py-1"><span className="invisible inline-flex h-8 w-32 items-center">—</span></TableCell>
                  <TableCell className="px-3 py-1"><span className="invisible inline-flex h-8 items-center">—</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft aria-hidden className="size-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight aria-hidden className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );

  // ===================== RENDER =====================

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex w-[min(576px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-x-hidden bg-background p-0 text-foreground sm:max-w-none"
          showCloseButton
        >
          {currentView === "main" && renderMainView()}
          {currentView === "members" && renderMembersView()}
        </DialogContent>
        {isAddDropdownOpen && dropdownPos
          ? createPortal(
            <div
              ref={addDropdownRef}
              className="fixed z-[100] w-64 rounded-lg border border-[var(--corportal-border-grey)] bg-popover p-1 shadow-md"
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
            >
              <div className="relative px-1 pb-1">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={addSearchInputRef}
                  type="text"
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full rounded-md border border-input bg-transparent py-1.5 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                  aria-label="Search user by name"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredAvailableUsers.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">No users found</p>
                ) : (
                  filteredAvailableUsers.map((u) => (
                    <button
                      key={u.userId}
                      type="button"
                      onClick={() => handleAddMember(u.userId)}
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {u.fullName}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
          : null}
      </Dialog>
      <AlertDialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{projectDraft.name}&quot;? This action can be undone later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
