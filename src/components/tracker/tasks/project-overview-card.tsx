"use client";

import { useEffect, type ReactNode } from "react";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { toast } from "sonner";
import type { ProjectOverviewDemo } from "@/components/tracker/tasks/project-overview-demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ProjectOverviewCardProps = {
  draft: ProjectOverviewDemo;
  onDescriptionSaved: (descriptionHtml: string) => void;
};

const ToolbarButton = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn(active && "bg-muted")}
  >
    {children}
  </Button>
);

export const ProjectOverviewCard = ({ draft, onDescriptionSaved }: ProjectOverviewCardProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: "Add a project description…" }),
    ],
    content: draft.descriptionHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "comment-prose min-h-40 px-3 py-2 text-sm outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5",
        "aria-label": "Project description",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== draft.descriptionHtml) {
      editor.commands.setContent(draft.descriptionHtml, { emitUpdate: false });
    }
  }, [draft.spaceId, draft.descriptionHtml, editor]);

  const handleSave = () => {
    if (!editor) return;
    onDescriptionSaved(editor.getHTML());
    toast.success("Description saved");
  };

  return (
    <Card size="sm" className="max-w-3xl ring-1 ring-[var(--corportal-border-grey)]">
      <CardHeader className="gap-2 space-y-0">
        <h2 className="text-xl font-semibold text-foreground">{draft.name}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Space · {draft.spaceName}</span>
          <span aria-hidden>·</span>
          <Badge variant={draft.isArchived ? "secondary" : "outline"}>
            {draft.isArchived ? "Archived" : "Active"}
          </Badge>
          <span aria-hidden>·</span>
          <span>
            {draft.memberCount} {draft.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Description</p>
          <Button type="button" size="sm" onClick={handleSave} disabled={!editor}>
            Save
          </Button>
        </div>
        <div className="rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <div className="flex flex-wrap items-center gap-1 border-b border-input px-2 py-1.5">
            <ToolbarButton
              label="Bold"
              active={editor?.isActive("bold") ?? false}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold className="size-3.5" aria-hidden />
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              active={editor?.isActive("italic") ?? false}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic className="size-3.5" aria-hidden />
            </ToolbarButton>
            <ToolbarButton
              label="Bullet list"
              active={editor?.isActive("bulletList") ?? false}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List className="size-3.5" aria-hidden />
            </ToolbarButton>
            <ToolbarButton
              label="Ordered list"
              active={editor?.isActive("orderedList") ?? false}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="size-3.5" aria-hidden />
            </ToolbarButton>
          </div>
          <EditorContent editor={editor} />
        </div>
      </CardContent>
    </Card>
  );
};
