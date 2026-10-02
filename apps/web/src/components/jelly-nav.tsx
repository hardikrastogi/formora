"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { animate, motion, motionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";

import "./jelly-nav.css";

export interface NavLink {
  href: string;
  label: string;
}

type ChipMotion = { x: MotionValue<number>; sx: MotionValue<number>; sy: MotionValue<number> };

const SWELL = 0.2;
const BARGE = 6;
const SHRINK = 0.05;
const JELLY = 1;
const BOUNCE = 0.25;
const STAGGER = 22;
const STIFFNESS = 580;

const spring = (k: number, m: number, bounce: number) => ({
  type: "spring" as const,
  stiffness: k,
  damping: 2 * Math.sqrt(k * m) * (1 - bounce),
  mass: m,
});

function Chip({
  mv,
  href,
  isCurrent,
  chipRef,
  onHover,
  onLeaveHover,
  children,
}: {
  mv: ChipMotion;
  href: string;
  isCurrent: boolean;
  chipRef: (el: HTMLSpanElement | null) => void;
  onHover: () => void;
  onLeaveHover: () => void;
  children: React.ReactNode;
}) {
  const transform = useTransform(() => `translateX(${mv.x.get()}px) scale(${mv.sx.get()}, ${mv.sy.get()})`);
  return (
    <Link
      href={href}
      className="Formora_DF__item-link"
      aria-current={isCurrent ? "page" : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onLeaveHover}
      onFocus={onHover}
      onBlur={onLeaveHover}
    >
      <motion.span ref={chipRef} style={{ transform }} className="Formora_DF__chip" data-active={isCurrent ? "true" : "false"}>
        <span className="Formora_DF__skin">
          <span className="Formora_DF__label">{children}</span>
        </span>
      </motion.span>
    </Link>
  );
}

/**
 * A nav-bar adaptation of React Bits' JellyRadio. The original is a
 * controlled radiogroup (click commits a selection); a nav has no
 * "selection" to commit — each item already navigates on its own via a real
 * <Link>. So the jelly swell/neighbour-push physics plays on hover/focus
 * instead, and the current route gets a persistent filled chip instead of a
 * radio "checked" state.
 */
export function JellyNav({ items }: { items: NavLink[] }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const groupRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const widths = useRef<number[]>([]);
  const mvs = useRef<ChipMotion[]>([]);

  const mvFor = (i: number) => {
    let mv = mvs.current[i];
    if (!mv) {
      mv = { x: motionValue(0), sx: motionValue(1), sy: motionValue(1) };
      mvs.current[i] = mv;
    }
    return mv;
  };

  const apply = (sel: number | null, instant: boolean) => {
    const group = groupRef.current;
    const rtl = group ? getComputedStyle(group).direction === "rtl" : false;
    const push = sel === null ? 0 : ((widths.current[sel] ?? 0) * SWELL) / 2 + BARGE;
    for (let i = 0; i < items.length; i++) {
      const mv = mvFor(i);
      const on = i === sel;
      const far = sel === null ? 0 : Math.abs(i - sel);
      const dir = sel === null ? 0 : Math.sign(i - sel) * (rtl ? -1 : 1);
      const x = sel === null ? 0 : dir * push;
      const s = sel === null ? 1 : on ? 1 + SWELL : 1 - SHRINK;
      if (instant || reduce) {
        mv.x.jump(x);
        mv.sx.jump(s);
        mv.sy.jump(s);
        continue;
      }
      const k = STIFFNESS * (1 - 0.12 * Math.min(far, 3));
      const inFlight = mv.x.isAnimating() || mv.sx.isAnimating() || mv.sy.isAnimating();
      const delay = inFlight ? 0 : (far * STAGGER) / 1000;
      animate(mv.x, x, { ...spring(k, 0.9, BOUNCE), delay });
      animate(mv.sx, s, {
        ...spring(k * (1 + 0.24 * JELLY), 0.9 - 0.1 * JELLY, Math.min(0.85, BOUNCE + 0.3 * JELLY)),
        delay,
      });
      animate(mv.sy, s, { ...spring(k * (1 - 0.14 * JELLY), 0.9 + 0.05 * JELLY, BOUNCE), delay: delay + 0.05 * JELLY });
    }
  };

  const measure = () => {
    widths.current = chipRefs.current.map((el) => el?.offsetWidth ?? 0);
  };

  useLayoutEffect(() => {
    measure();
    apply(null, true);
    const observer = new ResizeObserver(measure);
    if (groupRef.current) observer.observe(groupRef.current);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useLayoutEffect(() => {
    return () =>
      mvs.current.forEach((mv) => {
        mv.x.destroy();
        mv.sx.destroy();
        mv.sy.destroy();
      });
  }, []);

  const hover = (i: number) => apply(i, false);
  const leaveHover = () => apply(null, false);

  return (
    <div ref={groupRef} className="Formora_DF">
      {items.map((item, i) => (
        <Chip
          key={item.href}
          mv={mvFor(i)}
          href={item.href}
          isCurrent={item.href === pathname}
          chipRef={(el) => {
            chipRefs.current[i] = el;
          }}
          onHover={() => hover(i)}
          onLeaveHover={leaveHover}
        >
          {item.label}
        </Chip>
      ))}
    </div>
  );
}
