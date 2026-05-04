export type AdminUserDto = {
  id: string;
  email: string;
  role: "admin";
  createdAt: string;
};

export type AdminUsersDto = {
  items: AdminUserDto[];
};

export type AdminUsersRow = {
  id: string;
  email: string;
  roleLabel: string;
  createdAtLabel: string;
};

export type AdminUsersViewModel = {
  rows: AdminUsersRow[];
  isEmpty: boolean;
};

export function buildAdminUsersViewModel(
  dto: AdminUsersDto,
): AdminUsersViewModel {
  const rows = dto.items.map((item) => ({
    id: item.id,
    email: item.email,
    roleLabel: "Admin",
    createdAtLabel: formatDate(item.createdAt),
  }));

  return {
    rows,
    isEmpty: rows.length === 0,
  };
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}
