import { logoutAction } from "../actions/auth";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="meta-mono text-ink-soft hover:text-vermilion transition"
      >
        salir
      </button>
    </form>
  );
}
