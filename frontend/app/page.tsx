import { redirect } from "next/navigation";
import { Chat } from "./components/chat";
import { LogoutButton } from "./components/logout-button";
import { PageShell, PageTitle, Topbar } from "./components/notebook";
import { getCurrentTeacher } from "./lib/auth";

export default async function Home() {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/login");

  return (
    <PageShell>
      <Topbar
        right={
          <>
            <span className="meta-mono text-ink-soft">{teacher.name}</span>
            <LogoutButton />
          </>
        }
      />

      <PageTitle
        pre="Tu planificación,"
        emphasis="anotada"
        post="al margen."
        subtitle="Pregunta y ajusta tu plan a medida que avanza el curso. Cada respuesta cita la página del Programa."
      />

      <Chat />
    </PageShell>
  );
}
