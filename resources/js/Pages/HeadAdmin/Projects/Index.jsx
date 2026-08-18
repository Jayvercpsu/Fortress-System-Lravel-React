import { useLayoutTitle } from '../../../Components/Layout';
import ProjectsKanbanPage from '../../../Components/ProjectsKanbanPage';
import { Head, usePage } from '@inertiajs/react';

export default function HeadAdminProjectsIndex({ projectBoard = {} }) {
    const { auth } = usePage().props;
    const isHeadAdmin = ['head_admin', 'master_admin'].includes(auth?.user?.role);

    useLayoutTitle('Projects');

    return (
        <>
            <Head title="Projects" />
                <ProjectsKanbanPage
                    projectBoard={projectBoard}
                    canCreate
                    canEdit={isHeadAdmin}
                    canDelete={isHeadAdmin}
                />
        </>
    );
}
