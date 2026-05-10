type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
	sm: "h-7 w-7",
	md: "h-9 w-9",
	lg: "h-12 w-12",
};

const svgPx: Record<Size, number> = {
	sm: 14,
	md: 18,
	lg: 24,
};

export const AGENT_NAME = "Bita";

export function AgentAvatar({
	size = "md",
	className = "",
}: {
	size?: Size;
	className?: string;
}) {
	const px = svgPx[size];
	return (
		<span
			aria-label={AGENT_NAME}
			className={`grid shrink-0 place-items-center rounded-full bg-vermilion text-white shadow-sm ring-1 ring-inset ring-white/30 ${sizeClasses[size]} ${className}`}
		>
			<svg
				width={px}
				height={px}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<title>{AGENT_NAME}</title>
				<circle cx="12" cy="12" r="8.5" />
				<path d="M12 5.5v3.2" />
				<path d="M12 15.3v3.2" />
				<path d="M5.5 12h3.2" />
				<path d="M15.3 12h3.2" />
				<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
			</svg>
		</span>
	);
}
