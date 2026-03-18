import Layout from '../../../Components/Layout';
import ProjectsKanbanPage from '../../../Components/ProjectsKanbanPage';
import { Head, usePage } from '@inertiajs/react';

export default function HeadAdminProjectsIndex({ projectBoard = {} }) {
    const { auth } = usePage().props;
    const isHeadAdmin = auth?.user?.role === 'head_admin';

    return (
        <>
            <Head title="Projects" />
            <Layout title="Projects">
                <ProjectsKanbanPage
                    projectBoard={projectBoard}
                    canCreate
                    canEdit={isHeadAdmin}
                    canDelete={isHeadAdmin}
                />
            </Layout>
        </>
    );
}
