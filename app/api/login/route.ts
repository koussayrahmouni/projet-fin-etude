import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    try {
        const res = await auth.api.signInEmail({
            body: { email, password },
            headers: req.headers,
        });

        return NextResponse.json(res);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
}
