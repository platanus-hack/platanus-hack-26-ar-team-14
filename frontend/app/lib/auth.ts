import "server-only";

import { cookies } from "next/headers";

export const AUTH_COOKIE = "auth_token";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export type Teacher = { id: number; name: string; email: string };

export async function getToken(): Promise<string | null> {
	return (await cookies()).get(AUTH_COOKIE)?.value ?? null;
}

export async function getCurrentTeacher(): Promise<Teacher | null> {
	const token = await getToken();
	if (!token) return null;
	try {
		const res = await fetch(`${BACKEND_URL}/auth/me`, {
			headers: { authorization: `Bearer ${token}` },
			cache: "no-store",
		});
		if (!res.ok) return null;
		return (await res.json()) as Teacher;
	} catch {
		return null;
	}
}

export type TeacherCourse = {
	id: number;
	name: string;
	class_days: string[];
	block_number: number;
	plan_anual_id: number | null;
};

export async function getTeacherCourses(): Promise<TeacherCourse[]> {
	const token = await getToken();
	if (!token) return [];
	try {
		const res = await fetch(`${BACKEND_URL}/courses`, {
			headers: { authorization: `Bearer ${token}` },
			cache: "no-store",
		});
		if (!res.ok) return [];
		return (await res.json()) as TeacherCourse[];
	} catch {
		return [];
	}
}

export async function loginUpstream(
	email: string,
	password: string,
): Promise<
	{ token: string; teacher: Teacher } | { error: string; status: number }
> {
	try {
		const res = await fetch(`${BACKEND_URL}/auth/login`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email, password }),
			cache: "no-store",
		});
		if (!res.ok) {
			return {
				error:
					res.status === 401
						? "Credenciales inválidas."
						: "Error al iniciar sesión.",
				status: res.status,
			};
		}
		const data = (await res.json()) as {
			access_token: string;
			teacher: Teacher;
		};
		return { token: data.access_token, teacher: data.teacher };
	} catch {
		return {
			error: "No pude conectarme al backend de autenticación.",
			status: 503,
		};
	}
}
