import { LogOut } from "lucide-react";
import { logoutAction } from "../actions/auth";

export function LogoutButton() {
	return (
		<form action={logoutAction}>
			<button
				type="submit"
				aria-label="Cerrar sesión"
				className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-vermilion"
			>
				<LogOut size={16} strokeWidth={2} />
			</button>
		</form>
	);
}
