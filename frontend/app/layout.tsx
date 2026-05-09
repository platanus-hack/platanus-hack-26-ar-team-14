import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Bitácora · Copiloto pedagógico",
	description:
		"Bitácora ayuda a priorizar cursos por brecha curricular y corregir la planificación anual con apoyo de un copiloto pedagógico.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="es-CL"
			className="h-full antialiased"
			style={
				{
					"--font-instrument-serif": '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
					"--font-newsreader": 'Charter, "Iowan Old Style", "Palatino Linotype", Georgia, serif',
					"--font-jetbrains-mono": '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
				} as React.CSSProperties
			}
		>
			<body className="min-h-full flex flex-col bg-paper text-ink">
				{children}
			</body>
		</html>
	);
}
