"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
	code: string;
	objetivo: string;
	className?: string;
};

export function OaTag({ code, objetivo, className }: Props) {
	const tooltipId = useId();
	const triggerRef = useRef<HTMLSpanElement | null>(null);
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	function show() {
		const el = triggerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		// Anchor the tooltip just below the chip, aligned to its left edge.
		setPos({ top: rect.bottom + 6, left: rect.left });
		setOpen(true);
	}

	function hide() {
		setOpen(false);
	}

	return (
		<>
			<span
				ref={triggerRef}
				tabIndex={0}
				role="button"
				aria-describedby={open ? tooltipId : undefined}
				onMouseEnter={show}
				onMouseLeave={hide}
				onFocus={show}
				onBlur={hide}
				className={`cursor-help rounded-full border border-vermilion/30 bg-vermilion/5 px-2 py-0.5 text-[11px] font-semibold text-vermilion outline-none transition hover:border-vermilion/60 hover:bg-vermilion/10 focus-visible:ring-2 focus-visible:ring-vermilion/40${className ? ` ${className}` : ""}`}
			>
				{code}
			</span>
			{mounted && open && pos
				? createPortal(
						<div
							id={tooltipId}
							role="tooltip"
							style={{
								top: pos.top,
								left: pos.left,
								maxWidth: "min(24rem, calc(100vw - 1rem))",
							}}
							className="pointer-events-none fixed z-50 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] leading-snug text-slate-700 shadow-lg"
						>
							<span className="mb-1 inline-block rounded-full border border-vermilion/30 bg-vermilion/5 px-1.5 py-0.5 text-[10px] font-semibold text-vermilion">
								{code}
							</span>
							<p className="text-slate-700">{objetivo}</p>
						</div>,
						document.body,
					)
				: null}
		</>
	);
}
