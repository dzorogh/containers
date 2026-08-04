"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
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

const readPlainText = (node: HTMLElement | null) =>
  (node?.innerText ?? node?.textContent ?? "").replace(/\u00a0/g, " ");

const caretOffsetFromPoint = (root: HTMLElement, x: number, y: number): number | null => {
  let range: Range | null = null;
  if (typeof document.caretRangeFromPoint === "function") {
    range = document.caretRangeFromPoint(x, y);
  } else {
    const doc = document as Document & {
      caretPositionFromPoint?: (px: number, py: number) => {
        offsetNode: Node;
        offset: number;
      } | null;
    };
    const pos = doc.caretPositionFromPoint?.(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range || !root.contains(range.startContainer)) {
    return null;
  }
  const prefix = range.cloneRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  return prefix.toString().length;
};

const setCaretOffset = (node: HTMLElement, offset: number) => {
  const text = node.textContent ?? "";
  const clamped = Math.max(0, Math.min(offset, text.length));
  const textNode = node.firstChild;
  const range = document.createRange();
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    range.setStart(textNode, clamped);
    range.collapse(true);
  } else {
    range.selectNodeContents(node);
    range.collapse(false);
  }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

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
    const pendingCaretOffsetRef = useRef<number | null>(null);
    valueRef.current = value;

    useImperativeHandle(ref, () => ({
      focus: () => {
        nodeRef.current?.focus();
      },
      select: () => {
        const node = nodeRef.current;
        if (!node) {
          return;
        }
        setCaretOffset(node, (node.textContent ?? "").length);
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
      node.focus({ preventScroll: true });
      const offset = pendingCaretOffsetRef.current;
      pendingCaretOffsetRef.current = null;
      setCaretOffset(node, offset ?? (node.textContent ?? "").length);
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
          pendingCaretOffsetRef.current = (valueRef.current || "").length;
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

    const handleMouseDown = (event: MouseEvent<HTMLSpanElement>) => {
      if (editing) {
        event.stopPropagation();
        return;
      }
      const node = nodeRef.current;
      if (!node) {
        return;
      }
      pendingCaretOffsetRef.current = caretOffsetFromPoint(node, event.clientX, event.clientY);
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
          "min-w-0 truncate text-left text-sm font-medium outline-none focus:outline-none focus-visible:outline-none",
          editing ? "cursor-text" : "cursor-pointer hover:underline",
          className,
        )}
        onClick={() => {
          if (!editing) {
            onBeginEdit();
          }
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
      >
        {editing ? null : value || placeholder || ""}
      </span>
    );
  },
);

InlineEditableText.displayName = "InlineEditableText";
