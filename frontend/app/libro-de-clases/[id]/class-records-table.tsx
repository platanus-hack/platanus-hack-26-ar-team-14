"use client";

import { ArrowDown } from "lucide-react";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition,
} from "react";
import {
	type LearningRecord,
	registerRecordAction,
} from "../../actions/libro-de-clases";

const SPANISH_MONTHS_SHORT = [
	"ene",
	"feb",
	"mar",
	"abr",
	"may",
	"jun",
	"jul",
	"ago",
	"sep",
	"oct",
	"nov",
	"dic",
];

const SPANISH_WEEKDAYS_SHORT = [
	"dom",
	"lun",
	"mar",
	"mié",
	"jue",
	"vie",
	"sáb",
];

function formatShortDate(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	return `${SPANISH_WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${SPANISH_MONTHS_SHORT[date.getMonth()]}`;
}

function todayIso(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

type RecordStatus = "registered" | "pending" | "upcoming";

function computeStatus(record: LearningRecord, today: string): RecordStatus {
	if (record.registered) return "registered";
	if (record.class_date > today) return "upcoming";
	return "pending";
}

type Props = {
	records: LearningRecord[];
	currentRecordId: number;
	onAfterSave?: () => void;
};

export function ClassRecordsTable({
	records,
	currentRecordId,
	onAfterSave,
}: Props) {
	const currentRowRef = useRef<HTMLTableRowElement | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const [currentVisible, setCurrentVisible] = useState(true);
	const today = todayIso();

	const scrollToCurrent = useCallback(() => {
		currentRowRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
	}, []);

	useEffect(() => {
		scrollToCurrent();
	}, [scrollToCurrent]);

	useEffect(() => {
		const root = scrollContainerRef.current;
		const target = currentRowRef.current;
		if (!root || !target) return;
		const observer = new IntersectionObserver(
			([entry]) => setCurrentVisible(entry.isIntersecting),
			{ root, threshold: 0.4 },
		);
		observer.observe(target);
		return () => observer.disconnect();
	}, []);

	return (
		<article className="bitacora-card flex min-h-0 flex-col overflow-hidden p-0">
			<header className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
				<div className="min-w-0">
					<h2 className="font-display text-2xl leading-tight tracking-[-0.02em] text-slate-950">
						Libro de clases de {records[0]?.course_name ?? "Curso"}
					</h2>
					<p className="mt-1 text-xs italic text-slate-500">
						{records.length} clases registradas en el año
					</p>
				</div>
				<button
					type="button"
					onClick={scrollToCurrent}
					title="Esta es la clase que necesitas registrar"
					aria-hidden={currentVisible}
					tabIndex={currentVisible ? -1 : 0}
					className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition-opacity duration-200 hover:bg-amber-100 ${
						currentVisible ? "pointer-events-none opacity-0" : "opacity-100"
					}`}
				>
					<ArrowDown size={12} strokeWidth={2.5} />
					Ir al registro pendiente
				</button>
			</header>

			<div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto">
				<table className="w-full border-collapse text-[13px]">
					<thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
						<tr>
							<th className="border-b border-slate-200 px-4 py-2.5">Fecha</th>
							<th className="border-b border-slate-200 px-4 py-2.5">Bloque</th>
							<th className="border-b border-slate-200 px-4 py-2.5">OAs cubiertos</th>
							<th className="border-b border-slate-200 px-4 py-2.5">Observaciones</th>
							<th className="border-b border-slate-200 px-4 py-2.5">Estado</th>
						</tr>
					</thead>
					<tbody>
						{records.map((record) => {
							const isCurrent = record.id === currentRecordId;
							return (
								<Row
									key={record.id}
									ref={isCurrent ? currentRowRef : undefined}
									record={record}
									isCurrent={isCurrent}
									status={computeStatus(record, today)}
									onAfterSave={onAfterSave}
								/>
							);
						})}
						{records.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-8 text-center text-slate-500">
									Sin clases en este curso.
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</div>
		</article>
	);
}

type RowProps = {
	record: LearningRecord;
	isCurrent: boolean;
	status: RecordStatus;
	onAfterSave?: () => void;
	ref?: React.Ref<HTMLTableRowElement>;
};

function Row({ record, isCurrent, status, onAfterSave, ref }: RowProps) {
	const baseClass = "align-top transition-colors";
	const upcomingDim = status === "upcoming" ? " text-slate-400" : "";
	const rowClass = isCurrent
		? `${baseClass} bg-vermilion/5 ring-1 ring-inset ring-vermilion/30`
		: `${baseClass}${upcomingDim} hover:bg-slate-50/60`;

	return (
		<tr ref={ref} className={rowClass}>
			<td className="border-b border-slate-100 px-4 py-2.5 font-medium capitalize text-slate-800">
				{formatShortDate(record.class_date)}
			</td>
			<td className="border-b border-slate-100 px-4 py-2.5 text-slate-600 tabular-nums">
				{record.block_number}
			</td>
			<td className="border-b border-slate-100 px-4 py-2.5">
				{isCurrent ? (
					<EditableOaCell record={record} onAfterSave={onAfterSave} />
				) : (
					<OaBadges codes={record.oa_numbers} />
				)}
			</td>
			<td className="border-b border-slate-100 px-4 py-2.5 text-slate-700">
				{isCurrent ? (
					<EditableObservationsCell record={record} onAfterSave={onAfterSave} />
				) : (
					<ObservationsPreview text={record.observations} />
				)}
			</td>
			<td className="border-b border-slate-100 px-4 py-2.5">
				<StatusBadge status={status} />
			</td>
		</tr>
	);
}

function OaBadges({ codes }: { codes: string[] | null }) {
	if (!codes || codes.length === 0) {
		return <span className="text-slate-400">—</span>;
	}
	return (
		<div className="flex flex-wrap gap-1">
			{codes.map((code) => (
				<span
					key={code}
					className="rounded-full border border-vermilion/30 bg-vermilion/5 px-2 py-0.5 text-[11px] font-semibold text-vermilion"
				>
					{code}
				</span>
			))}
		</div>
	);
}

function ObservationsPreview({ text }: { text: string | null }) {
	if (!text) return <span className="text-slate-400">—</span>;
	return <p className="line-clamp-2 max-w-md text-slate-700">{text}</p>;
}

function StatusBadge({ status }: { status: RecordStatus }) {
	if (status === "registered") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
				<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
				Registrado
			</span>
		);
	}
	if (status === "pending") {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
				<span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
				Pendiente
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
			<span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
			Próxima
		</span>
	);
}

function EditableOaCell({
	record,
	onAfterSave,
}: {
	record: LearningRecord;
	onAfterSave?: () => void;
}) {
	const initial = (record.oa_numbers ?? []).join(", ");
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(initial);
	const [pending, startTransition] = useTransition();

	useEffect(() => {
		setValue((record.oa_numbers ?? []).join(", "));
	}, [record.oa_numbers]);

	function commit() {
		setEditing(false);
		const codes = value
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const original = (record.oa_numbers ?? []).join(", ");
		if (value === original) return;
		if (codes.length === 0) return;
		startTransition(async () => {
			try {
				await registerRecordAction(record.id, {
					oa_numbers: codes,
					observations: record.observations,
				});
				onAfterSave?.();
			} catch {
				setValue(original);
			}
		});
	}

	function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();
			(e.target as HTMLInputElement).blur();
		} else if (e.key === "Escape") {
			setValue(initial);
			setEditing(false);
		}
	}

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => setEditing(true)}
				className="-mx-1 -my-0.5 flex w-full min-w-0 cursor-text rounded px-1 py-0.5 text-left hover:bg-vermilion/10"
				disabled={pending}
			>
				<OaBadges codes={record.oa_numbers} />
			</button>
		);
	}

	return (
		<input
			autoFocus
			type="text"
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={commit}
			onKeyDown={onKeyDown}
			placeholder="OA1, OA4, OA7"
			disabled={pending}
			className="w-full rounded border border-vermilion/40 bg-white px-2 py-1 text-[13px] focus:border-vermilion focus:outline-none disabled:opacity-60"
		/>
	);
}

function EditableObservationsCell({
	record,
	onAfterSave,
}: {
	record: LearningRecord;
	onAfterSave?: () => void;
}) {
	const initial = record.observations ?? "";
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(initial);
	const [pending, startTransition] = useTransition();

	useEffect(() => {
		setValue(record.observations ?? "");
	}, [record.observations]);

	function commit() {
		setEditing(false);
		const trimmed = value.trim();
		if (trimmed === (record.observations ?? "").trim()) return;
		const codes = record.oa_numbers ?? [];
		if (codes.length === 0) return;
		startTransition(async () => {
			try {
				await registerRecordAction(record.id, {
					oa_numbers: codes,
					observations: trimmed || null,
				});
				onAfterSave?.();
			} catch {
				setValue(initial);
			}
		});
	}

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			(e.target as HTMLTextAreaElement).blur();
		} else if (e.key === "Escape") {
			setValue(initial);
			setEditing(false);
		}
	}

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => setEditing(true)}
				className="-mx-1 -my-0.5 flex w-full min-w-0 cursor-text rounded px-1 py-0.5 text-left hover:bg-vermilion/10"
				disabled={pending}
			>
				<ObservationsPreview text={record.observations} />
			</button>
		);
	}

	return (
		<textarea
			autoFocus
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={commit}
			onKeyDown={onKeyDown}
			placeholder="Síntesis de la clase…"
			rows={3}
			disabled={pending}
			className="w-full max-w-md resize-none rounded border border-vermilion/40 bg-white px-2 py-1 text-[13px] leading-snug focus:border-vermilion focus:outline-none disabled:opacity-60"
		/>
	);
}
