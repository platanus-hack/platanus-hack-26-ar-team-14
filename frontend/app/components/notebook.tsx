/**
 * Notebook UI primitives — kit base reutilizable.
 * Papel crema, tinta, vermillón como acento. Nada más.
 */

import type { FormEvent, ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
	return (
		<main className="mx-auto flex h-screen w-full max-w-2xl flex-col gap-6 px-6 py-10">
			{children}
		</main>
	);
}

export function Topbar({
	title = "Cuaderno",
	right,
}: {
	title?: string;
	right?: ReactNode;
}) {
	return (
		<header className="flex items-baseline justify-between gap-4">
			<span className="font-display text-2xl italic leading-none">{title}</span>
			<div className="flex items-baseline gap-3">
				<span className="meta-mono">5° básico · Matemática</span>
				{right}
			</div>
		</header>
	);
}

export function PageTitle({
	pre,
	emphasis,
	post,
	subtitle,
}: {
	pre?: ReactNode;
	emphasis: ReactNode;
	post?: ReactNode;
	subtitle?: ReactNode;
}) {
	return (
		<div>
			<h1 className="font-display text-[clamp(36px,6vw,56px)] leading-[1.02] tracking-[-0.01em]">
				{pre} <em className="italic text-vermilion">{emphasis}</em> {post}
			</h1>
			{subtitle ? (
				<p className="mt-3 max-w-[52ch] font-serif text-[16px] leading-relaxed text-ink-soft">
					{subtitle}
				</p>
			) : null}
		</div>
	);
}

export function MessageBlock({
	role,
	children,
}: {
	role: "teacher" | "assistant";
	children: ReactNode;
}) {
	const label = role === "teacher" ? "Profe" : "Cuaderno";
	return (
		<article className="flex gap-4">
			<div className="meta-mono w-14 shrink-0 pt-[5px]">{label}</div>
			<div
				className={[
					"min-w-0 flex-1 font-serif text-[16px] leading-[1.55]",
					role === "teacher" ? "italic text-ink-soft" : "text-ink",
				].join(" ")}
			>
				{children}
			</div>
		</article>
	);
}

export function ToolLine({ children }: { children: ReactNode }) {
	return <div className="tool-tag">↳ {children}</div>;
}

export function ThinkingDots() {
	return <span className="text-muted italic">pensando…</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
	return (
		<p className="max-w-[42ch] font-display text-[24px] italic leading-[1.2] text-ink-soft">
			{children}
		</p>
	);
}

export function ErrorNote({ children }: { children: ReactNode }) {
	return (
		<pre className="whitespace-pre-wrap border-l-2 border-vermilion pl-3 font-mono text-[12px] text-vermilion">
			{children}
		</pre>
	);
}

export function NotebookForm({
	value,
	onChange,
	onSubmit,
	disabled,
	placeholder = "Escribe una nota o una pregunta…",
}: {
	value: string;
	onChange: (v: string) => void;
	onSubmit: (e: FormEvent) => void;
	disabled?: boolean;
	placeholder?: string;
}) {
	return (
		<form onSubmit={onSubmit} className="flex items-end gap-3">
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="notebook-input flex-1"
				disabled={disabled}
				autoComplete="off"
			/>
			<button
				type="submit"
				disabled={disabled || !value.trim()}
				className="btn"
			>
				Anotar
			</button>
		</form>
	);
}
