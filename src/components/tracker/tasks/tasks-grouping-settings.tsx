"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_GROUP_BY_OPTIONS,
  type TaskGroupBy,
} from "@/features/tracker/tasks/task-grouping";

type TasksGroupingSettingsProps = {
  levels: TaskGroupBy[];
  onLevelsChange: (levels: TaskGroupBy[]) => void;
};

const isTaskGroupBy = (value: string): value is TaskGroupBy =>
  TASK_GROUP_BY_OPTIONS.some((opt) => opt.value === value);

export const TasksGroupingSettings = ({ levels, onLevelsChange }: TasksGroupingSettingsProps) => {
  const used = new Set(levels);

  const updateAt = (index: number, value: TaskGroupBy) => {
    const next = [...levels];
    next[index] = value;
    onLevelsChange(next);
  };

  const removeAt = (index: number) => {
    onLevelsChange(levels.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= levels.length) return;
    const next = [...levels];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onLevelsChange(next);
  };

  const addLevel = () => {
    const nextValue = TASK_GROUP_BY_OPTIONS.find((opt) => !used.has(opt.value))?.value;
    if (!nextValue || levels.length >= 5) return;
    onLevelsChange([...levels, nextValue]);
  };

  return (
    <div className="flex w-80 flex-col gap-3 p-1">
      <div>
        <p className="text-sm font-medium text-foreground">Group by</p>
        <p className="text-xs text-muted-foreground">0 levels = flat list. Up to 5 nested levels.</p>
      </div>

      <ul className="flex flex-col gap-2">
        {levels.map((level, index) => {
          const availableOptions = TASK_GROUP_BY_OPTIONS.filter(
            (opt) => opt.value === level || !used.has(opt.value),
          );
          const selectItems = availableOptions.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }));

          return (
            <li key={`${level}-${index}`} className="flex items-center gap-1.5">
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move level ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move level ${index + 1} down`}
                  disabled={index === levels.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden className="size-3.5" />
                </Button>
              </div>
              <Select
                items={selectItems}
                value={level}
                onValueChange={(value) => {
                  if (!value || !isTaskGroupBy(value)) return;
                  updateAt(index, value);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 flex-1"
                  aria-label={`Grouping level ${index + 1}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove grouping level ${index + 1}`}
                onClick={() => removeAt(index)}
              >
                <X aria-hidden className="size-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-dashed"
        disabled={levels.length >= 5 || used.size >= TASK_GROUP_BY_OPTIONS.length}
        onClick={addLevel}
      >
        <Plus aria-hidden className="size-3.5" />
        Add level
      </Button>
    </div>
  );
};
