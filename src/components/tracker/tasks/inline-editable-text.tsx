"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

export type InlineEditableTextHandle = {
  focus: () => void;
  select: () => void;
  getValue: () => string;
  skipNextBlurCommit: () => void;
};

type InlineEditableTextProps = {
  value: string;
  editing: boolean;
  onBeginEdit: () => void;
  onCommit: (next: string) => void;
  onCancel: () => void;
  /**
   * Custom key handling while editing.
   * Return true if the event was fully handled (caller should skip default Enter commit).
   */
  onKeyDown?: (event: KeyboardEvent<HTMLSpanElement>, draft: string) => boolean | void;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

const selectAllContents = (node: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const readPlainText = (node: HTMLElement | null) =>
  (node?.innerText ?? node?.textContent ?? "").replace(/\u00a0/g, " ");

export const InlineEditableText = forwardRef<InlineEditableTextHandle, InlineEditableTextProps>(
  (
    {
      value,
      editing,
      onBeginEdit,
      onCommit,
      onCancel,
      onKeyDown,
      className,
      placeholder,
      "aria-label": ariaLabel,
    },
    ref,
  ) => {
    const nodeRef = useRef<HTMLSpanElement | null>(null);
    const skipBlurCommitRef = useRef(false);
    const valueRef = useRef(value);
    valueRef.current = value;

    useImperativeHandle(ref, () => ({
      focus: () => {
        nodeRef.current?.focus();
      },
      select: () => {
        if (nodeRef.current) {
          selectAllContents(nodeRef.current);
        }
      },
      getValue: () => readPlainText(nodeRef.current),
      skipNextBlurCommit: () => {
        skipBlurCommitRef.current = true;
      },
    }));

    useEffect(() => {
      const node = nodeRef.current;
      if (!editing || !node) {
        return;
      }
      node.textContent = valueRef.current;
      node.focus();
      selectAllContents(node);
    }, [editing]);

    const handleBlur = () => {
      if (!editing) {
        return;
      }
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false;
        return;
      }
      onCommit(readPlainText(nodeRef.current));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
      if (!editing) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onBeginEdit();
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        skipBlurCommitRef.current = true;
        onCancel();
        return;
      }

      const draft = readPlainText(nodeRef.current);
      if (onKeyDown?.(event, draft)) {
        return;
      }

      if (event.key === "Enter") {
        onCommit(draft);
      }
    };

    return (
      <span
        ref={nodeRef}
        role={editing ? "textbox" : "button"}
        tabIndex={0}
        contentEditable={editing}
        suppressContentEditableWarning
        aria-label={ariaLabel}
        aria-multiline={false}
        data-placeholder={placeholder}
        className={cn(
          "min-w-0 truncate text-left text-sm font-medium outline-none",
          editing
            ? "cursor-text rounded-sm ring-2 ring-ring"
            : "cursor-pointer hover:underline focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        onClick={() => {
          if (!editing) {
            onBeginEdit();
          }
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => {
          if (editing) {
            event.stopPropagation();
          }
        }}
      >
        {editing ? null : value || placeholder || ""}
      </span>
    );
  },
);

InlineEditableText.displayName = "InlineEditableText";
