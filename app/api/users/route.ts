import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import { hash } from 'bcrypt'; // Assuming you use bcryptjs for password hashing (common in Next.js apps). Install if needed: npm i bcryptjs @types/bcryptjs

const ALLOWED_ROLES = ['superadmin', 'admin', 'collaborator', 'client'] as const;

export async function GET(req: Request) {
    try {
        const session = await auth.api.getSession({ headers: req.headers });

        if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            );
        }

        const client = await pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    id, 
                    email, 
                    name, 
                    image, 
                    role, 
                    created_at AS "createdAt", 
                    updated_at AS "updatedAt"
                FROM users
                ORDER BY created_at DESC
                LIMIT 100
            `);

            return NextResponse.json(result.rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({ headers: req.headers });

        if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { email, name, password, role = 'client' } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json(
                { error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` },
                { status: 400 }
            );
        }

        // Optional: only allow superadmin to create another superadmin
        if (role === 'superadmin' && session.user.role !== 'superadmin') {
            return NextResponse.json(
                { error: 'Only superadmin can create superadmin accounts' },
                { status: 403 }
            );
        }

        // Direct insert with bcrypt hashing to match your custom client-side signup flow
        const hashedPassword = await hash(password, 12);

        const client = await pool.connect();
        try {
            const result = await client.query(
                `INSERT INTO users (
                    id,
                    email,
                    password,  -- assuming your users table has a password column (hashed)
                    name,
                    role,
                    created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(),
                    $1,
                    $2,
                    $3,
                    $4,
                    NOW(),
                    NOW()
                ) RETURNING id, email, name, role, created_at AS "createdAt", updated_at AS "updatedAt"`,
                [email, hashedPassword, name?.trim() || null, role]
            );

            const newUser = result.rows[0];

            return NextResponse.json(
                {
                    user: newUser,
                    message: 'User created successfully',
                },
                { status: 201 }
            );
        } catch (dbError: any) {
            if (dbError.code === '23505' && dbError.constraint?.includes('email')) {
                return NextResponse.json(
                    { error: 'Email already exists' },
                    { status: 409 }
                );
            }
            throw dbError;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('User creation error:', err);

        let status = 500;
        let message = err.message || 'Failed to create user';

        if (message.includes('password')) {
            message = 'Password does not meet requirements';
        }

        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await auth.api.getSession({ headers: req.headers });

        if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        if (id === session.user.id) {
            return NextResponse.json(
                { error: 'Cannot delete your own account' },
                { status: 403 }
            );
        }

        const client = await pool.connect();
        try {
            const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

            if (result.rowCount === 0) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            return NextResponse.json({ success: true, message: 'User deleted successfully' });
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('User deletion error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to delete user' },
            { status: 500 }
        );
    }
}