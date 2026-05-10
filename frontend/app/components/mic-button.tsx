"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { transcribeAudioAction } from "../actions/transcribe";

type Props = {
	onTranscribed: (text: string) => void;
	disabled?: boolean;
};

function pickMimeType(): string | undefined {
	if (typeof MediaRecorder === "undefined") return undefined;
	const candidates = [
		"audio/webm;codecs=opus",
		"audio/webm",
		"audio/ogg;codecs=opus",
		"audio/mp4",
	];
	for (const t of candidates) {
		if (MediaRecorder.isTypeSupported(t)) return t;
	}
	return undefined;
}

export function MicButton({ onTranscribed, disabled }: Props) {
	const [recording, setRecording] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);

	useEffect(() => {
		return () => {
			const rec = recorderRef.current;
			if (rec && rec.state === "recording") rec.stop();
			streamRef.current?.getTracks().forEach((t) => t.stop());
		};
	}, []);

	async function start() {
		setError(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const mimeType = pickMimeType();
			const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			chunksRef.current = [];
			rec.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};
			rec.onstop = async () => {
				stream.getTracks().forEach((t) => t.stop());
				streamRef.current = null;
				const type = rec.mimeType || "audio/webm";
				const blob = new Blob(chunksRef.current, { type });
				chunksRef.current = [];
				if (blob.size === 0) return;
				setBusy(true);
				try {
					const ext = type.includes("mp4")
						? "m4a"
						: type.includes("ogg")
							? "ogg"
							: "webm";
					const file = new File([blob], `nota.${ext}`, { type });
					const fd = new FormData();
					fd.append("file", file);
					const text = await transcribeAudioAction(fd);
					if (text) onTranscribed(text);
				} catch (e) {
					setError(e instanceof Error ? e.message : "Error transcribiendo");
				} finally {
					setBusy(false);
				}
			};
			rec.start();
			recorderRef.current = rec;
			setRecording(true);
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "No se pudo acceder al micrófono",
			);
		}
	}

	function stop() {
		const rec = recorderRef.current;
		if (rec && rec.state === "recording") rec.stop();
		setRecording(false);
	}

	const isDisabled = disabled || busy;
	const icon = busy ? (
		<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
	) : recording ? (
		<Square className="h-4 w-4 fill-current" aria-hidden />
	) : (
		<Mic className="h-4 w-4" aria-hidden />
	);
	const title = busy
		? "Transcribiendo…"
		: recording
			? "Detener y transcribir"
			: "Grabar nota de voz";

	return (
		<div className="flex flex-col items-end gap-1">
			<button
				type="button"
				onClick={recording ? stop : start}
				disabled={isDisabled}
				title={title}
				aria-label={title}
				className={[
					"btn inline-flex items-center justify-center",
					recording ? "bg-vermilion text-paper" : "",
					"min-w-[2.5rem]",
				].join(" ")}
			>
				{icon}
			</button>
			{error ? (
				<span className="meta-mono text-vermilion">{error}</span>
			) : null}
		</div>
	);
}
