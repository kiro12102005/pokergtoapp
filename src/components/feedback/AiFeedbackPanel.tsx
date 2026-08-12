"use client";

import { useState } from "react";
import { SUGGESTED_AI_FEEDBACK_TAGS } from "@/engine/history/aiFeedbackTags";

/**
 * The "reverse import" half of the copy-prompt round trip PromptCopyPanel starts: lets the user
 * paste back what an external chat AI (ChatGPT/Gemini/Claude, ...) said about this hand and tag
 * it with a leak category, turning a saved analysis into a searchable AI-assisted hand note
 * instead of just a one-off prompt. Editable in place any time via editing/onSave, same pattern
 * as the isPublic toggle elsewhere on the card.
 */
export function AiFeedbackPanel({
  aiFeedback,
  tags,
  onSave,
}: {
  aiFeedback: string | null;
  tags: string[];
  onSave: (aiFeedback: string | null, tags: string[]) => void;
}) {
  const hasSaved = Boolean(aiFeedback) || tags.length > 0;
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(aiFeedback ?? "");
  const [draftTags, setDraftTags] = useState<string[]>(tags);
  const [customTag, setCustomTag] = useState("");

  const toggleTag = (tag: string) => {
    setDraftTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !draftTags.includes(trimmed)) setDraftTags((prev) => [...prev, trimmed]);
    setCustomTag("");
  };

  const startEditing = () => {
    setDraftText(aiFeedback ?? "");
    setDraftTags(tags);
    setCustomTag("");
    setEditing(true);
  };

  const handleSave = () => {
    onSave(draftText.trim() || null, draftTags);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-zinc-600 dark:text-zinc-300">外部AIの回答メモ</span>
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 rounded bg-zinc-200 px-3 py-1 font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
          >
            {hasSaved ? "編集" : "回答を貼り付ける"}
          </button>
        </div>
        {!hasSaved && (
          <p className="text-zinc-500 dark:text-zinc-400">
            上のプロンプトをGemini・ChatGPT・Claudeなどに貼り付けて相談した結果を、ここに貼り戻して保存できます。
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {aiFeedback && (
          <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{aiFeedback}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-sky-300 bg-sky-50 p-3 text-xs dark:border-sky-800 dark:bg-sky-950">
      <span className="font-semibold text-zinc-600 dark:text-zinc-300">外部AIの回答メモ</span>
      <textarea
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        placeholder="外部AIチャットの回答をここに貼り付け"
        rows={5}
        className="rounded border border-zinc-300 bg-white p-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      <div className="flex flex-wrap gap-1">
        {SUGGESTED_AI_FEEDBACK_TAGS.map((tag) => {
          const selected = draftTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={
                selected
                  ? "rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                  : "rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }
            >
              {tag}
            </button>
          );
        })}
        {draftTags
          .filter((t) => !SUGGESTED_AI_FEEDBACK_TAGS.includes(t))
          .map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white"
            >
              {tag} ×
            </button>
          ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomTag();
            }
          }}
          placeholder="タグを自分で入力"
          className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={addCustomTag}
          className="shrink-0 rounded bg-zinc-200 px-2 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
        >
          追加
        </button>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded bg-zinc-200 px-3 py-1 font-bold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded bg-sky-600 px-3 py-1 font-bold text-white hover:bg-sky-700"
        >
          保存
        </button>
      </div>
    </div>
  );
}
