// vendors table row/API shapes (flat fields + metadata jsonb, as before).

export interface IVendor {
  _id: string;
  name: string;
  address?: string | null;
  contact_person?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    created_by?: string;
    created_by_id?: string;
    last_modified_by?: string;
  };
}

export interface VendorRow extends Omit<IVendor, '_id'> {
  id: string;
}

export const toVendor = (row: VendorRow): IVendor => {
  const { id, ...rest } = row;
  return { ...rest, _id: id };
};
