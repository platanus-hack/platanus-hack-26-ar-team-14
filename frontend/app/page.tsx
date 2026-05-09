import { PageShell, Topbar, PageTitle } from "./components/notebook";
import { Chat } from "./components/chat";

export default function Home() {
  return (
    <PageShell>
      <Topbar />

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
