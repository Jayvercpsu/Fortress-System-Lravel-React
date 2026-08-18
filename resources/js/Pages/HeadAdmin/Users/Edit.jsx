import UserFormPage from '../../../Components/UserFormPage';

export default function EditUser({ user, canManageHeadAdmins }) {
    return <UserFormPage mode="edit" user={user} canManageHeadAdmins={canManageHeadAdmins} />;
}
