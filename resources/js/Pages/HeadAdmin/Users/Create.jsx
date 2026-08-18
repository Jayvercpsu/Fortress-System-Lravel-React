import UserFormPage from '../../../Components/UserFormPage';

export default function CreateUser({ user, canManageHeadAdmins }) {
    return <UserFormPage mode="create" user={user} canManageHeadAdmins={canManageHeadAdmins} />;
}
