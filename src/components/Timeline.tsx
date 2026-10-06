"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { drawClip, startOf } from "@/lib/playback";
import { totalLength, type Clip } from "@/lib/clips";

/** 1초가 몇 픽셀인지. 조각 길이가 폭으로 보여야 길이 감각이 생긴다. */
const PX_PER_SECOND = 56;
const MIN_LENGTH = 0.5;

interface Props {
  clips: Clip[];
  selectedId: string | null;
  time: number;
  onSelect: (id: string) => void;
  onReorder: (clips: Clip[]) => void;
  onPatch: (id: string, next: Partial<Clip>) => void;
  onRemove: (id: string) => void;
  onSeek: (seconds: number) => void;
}

export default function Timeline(props: Props) {
  const { clips, selectedId, time, onSelect, onReorder, onPatch, onRemove, onSeek } = props;
  const trackRef = useRef<HTMLDivElement>(null);
  const total = totalLength(clips);

  const sensors = useSensors(
    // 조금 끌어야 드래그로 친다. 안 그러면 클릭으로 고르는 것조차 어렵다.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = clips.findIndex((c) => c.id === active.id);
    const to = clips.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;

    onReorder(arrayMove(clips, from, to));
  }

  return (
    <div className="timeline">
      <div className="timeline-ruler" style={{ width: total * PX_PER_SECOND }}>
        {Array.from({ length: Math.ceil(total) + 1 }, (_, s) => (
          <span key={s} style={{ left: s * PX_PER_SECOND }}>
            {s}s
          </span>
        ))}
      </div>

      <div
        ref={trackRef}
        className="timeline-track"
        onClick={(e) => {
          // 조각이 아니라 빈 곳을 누르면 그 시각으로 재생 머리를 옮긴다.
          if (e.target !== e.currentTarget) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek((e.clientX - rect.left + e.currentTarget.scrollLeft) / PX_PER_SECOND);
        }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={clips.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {clips.map((clip) => (
              <ClipChip
                key={clip.id}
                clip={clip}
                selected={clip.id === selectedId}
                onSelect={() => onSelect(clip.id)}
                onPatch={(next) => onPatch(clip.id, next)}
                onRemove={() => onRemove(clip.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {total > 0 && <div className="playhead" style={{ left: time * PX_PER_SECOND }} />}
      </div>
    </div>
  );
}

function ClipChip({
  clip,
  selected,
  onSelect,
  onPatch,
  onRemove,
}: {
  clip: Clip;
  selected: boolean;
  onSelect: () => void;
  onPatch: (next: Partial<Clip>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clip.id });
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const [trimming, setTrimming] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    const canvas = thumbRef.current;
    if (!canvas) return;
    canvas.width = 96;
    canvas.height = 54;
    drawClip(canvas, clip, [], 0, 4);
  }, [clip, clip.transform]);

  /**
   * 양쪽 끝을 끌어 구간을 잡는다. 숫자를 입력하는 것보다 감이 온다.
   *
   * 오른쪽은 길이만 바꾼다.
   * 왼쪽은 시작 지점을 옮기면서 길이를 같이 줄여, 끝나는 장면은 그대로 둔다.
   * 왼쪽을 끌었는데 뒷부분까지 따라 움직이면 앞뒤를 번갈아 맞춰야 해서 못 쓴다.
   */
  function startTrim(e: React.PointerEvent, edge: "start" | "end") {
    e.stopPropagation();
    e.preventDefault();
    setTrimming(edge);

    const originX = e.clientX;
    const from = { start: clip.start, length: clip.length };
    const round = (v: number) => Math.round(v * 10) / 10;

    const move = (ev: PointerEvent) => {
      const delta = (ev.clientX - originX) / PX_PER_SECOND;

      if (edge === "end") {
        const limit = clip.isVideo ? Math.max(MIN_LENGTH, clip.sourceDuration - from.start) : 30;
        onPatch({ length: round(Math.min(limit, Math.max(MIN_LENGTH, from.length + delta))) });
        return;
      }

      // 이미지는 원본에 시작 지점이 없다. 길이만 줄인다.
      if (!clip.isVideo) {
        onPatch({ length: round(Math.max(MIN_LENGTH, from.length - delta)) });
        return;
      }

      const moved = Math.min(
        from.start + from.length - MIN_LENGTH,
        Math.max(0, from.start + delta)
      );
      onPatch({ start: round(moved), length: round(from.start + from.length - moved) });
    };

    const up = () => {
      setTrimming(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      ref={setNodeRef}
      className={`chip${selected ? " on" : ""}${isDragging ? " dragging" : ""}`}
      style={{
        width: clip.length * PX_PER_SECOND,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      onClick={onSelect}
    >
      <div className="chip-grab" {...attributes} {...listeners}>
        <canvas ref={thumbRef} />
        <span className="chip-name">{clip.name}</span>
        <span className="chip-time">
          {clip.isVideo && clip.start > 0 && <em>{clip.start.toFixed(1)}s~ </em>}
          {clip.length.toFixed(1)}s
        </span>
      </div>

      <button
        className="chip-remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ✕
      </button>

      <div
        className={`chip-trim left${trimming === "start" ? " on" : ""}`}
        onPointerDown={(e) => startTrim(e, "start")}
        title="끌어서 시작 지점 조절"
      />
      <div
        className={`chip-trim right${trimming === "end" ? " on" : ""}`}
        onPointerDown={(e) => startTrim(e, "end")}
        title="끌어서 끝 지점 조절"
      />
    </div>
  );
}
