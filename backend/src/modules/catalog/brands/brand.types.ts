export interface CreateBrandInput {
  name: string;
  image: string;
}

export interface UpdateBrandInput {
  name?: string;
  image?: string;
  isActive?: boolean;
}
