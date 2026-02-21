import Layout from '../../../Components/Layout';
import { Head, Link } from '@inertiajs/react';

export default function HeadAdminProjectsIndex({ projects = [] }) {
    return (
        <>
            <Head title="Projects" />
            <Layout title="Projects">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <Link
                        href="/projects/create"
                        style={{
                            background: 'var(--success)',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '9px 14px',
                            textDecoration: 'none',
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        + Create Project
                    </Link>
                </div>

                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Name', 'Client', 'Phase', 'Status', 'Progress', 'Actions'].map((h) => (
                                    <th key={h} style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted-2)', padding: '10px 14px', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map((project) => (
                                <tr key={project.id} style={{ borderBottom: '1px solid var(--row-divider)' }}>
                                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{project.name}</td>
                                    <td style={{ padding: '12px 14px' }}>{project.client}</td>
                                    <td style={{ padding: '12px 14px' }}>{project.phase}</td>
                                    <td style={{ padding: '12px 14px' }}>{project.status}</td>
                                    <td style={{ padding: '12px 14px' }}>{project.overall_progress}%</td>
                                    <td style={{ padding: '12px 14px', display: 'flex', gap: 8 }}>
                                        <Link href={`/projects/${project.id}`} style={{ color: 'var(--active-text)', textDecoration: 'none', fontSize: 13 }}>View</Link>
                                        <Link href={`/projects/${project.id}/edit`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 13 }}>Edit</Link>
                                    </td>
                                </tr>
                            ))}
                            {projects.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No projects yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Layout>
        </>
    );
}
