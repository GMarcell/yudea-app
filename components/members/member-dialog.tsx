"use client";

import {
  useDistricts,
  useProvinces,
  useRegencies,
  useVillages,
} from "@/hooks/use-indonesia-region";
import { useRegions } from "@/hooks/use-region";
import { useFamilies } from "@/hooks/use-family";
import { useCreateMember, useUpdateMember } from "@/hooks/use-member";
import {
  genderOptions,
  bloodTypeOptions,
  memberRoleOptions,
  baptisStatusOptions,
  sidiStatusOptions,
  perkawinanStatusOptions,
  jabatanOptions,
  type Member,
  type MemberForm,
} from "@/types/member";
import {
  Edit,
  Mail,
  MapPin,
  Phone,
  Plus,
  User,
  Users,
  Hash,
  Church,
  Heart,
  Briefcase,
  FileText,
} from "lucide-react";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useDialogForm } from "@/hooks/use-dialog-form";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";

type MemberAddressRegion = {
  memberProvinsi: string;
  memberKotaKabupaten: string;
  memberKecamatan: string;
  memberKelurahan: string;
};

function IndonesiaMemberRegionSelects({
  values,
  onChange,
}: {
  values: MemberAddressRegion;
  onChange: (field: keyof MemberAddressRegion, value: string) => void;
}) {
  const { data: provinces, isLoading: provincesLoading, isError: provincesError } = useProvinces();
  const [provinceCode, setProvinceCode] = useState("");
  const [regencyCode, setRegencyCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [villageCode, setVillageCode] = useState("");

  const selectedProvinceCode =
    provinceCode || provinces?.find((item) => item.name === values.memberProvinsi)?.code || "";
  const { data: regencies, isLoading: regenciesLoading, isError: regenciesError } =
    useRegencies(selectedProvinceCode || null);
  const selectedRegencyCode =
    regencyCode || regencies?.find((item) => item.name === values.memberKotaKabupaten)?.code || "";
  const { data: districts, isLoading: districtsLoading, isError: districtsError } =
    useDistricts(selectedRegencyCode || null);
  const selectedDistrictCode =
    districtCode || districts?.find((item) => item.name === values.memberKecamatan)?.code || "";
  const { data: villages, isLoading: villagesLoading, isError: villagesError } =
    useVillages(selectedDistrictCode || null);
  const selectedVillageCode =
    villageCode || villages?.find((item) => item.name === values.memberKelurahan)?.code || "";

  const selectClassName = "w-full";

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="memberProvinsi">Provinsi</Label>
        <Select
          value={selectedProvinceCode}
          onValueChange={(code) => {
            setProvinceCode(code);
            setRegencyCode("");
            setDistrictCode("");
            setVillageCode("");
            onChange("memberProvinsi", provinces?.find((item) => item.code === code)?.name ?? "");
            onChange("memberKotaKabupaten", "");
            onChange("memberKecamatan", "");
            onChange("memberKelurahan", "");
          }}
          disabled={provincesLoading}
        >
          <SelectTrigger id="memberProvinsi" className={selectClassName}>
            <SelectValue placeholder={provincesLoading ? "Memuat…" : "Pilih Provinsi"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {provinces?.map((item) => (
                <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {provincesError && <p className="text-xs text-destructive">Gagal memuat data provinsi.</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="memberKotaKabupaten">Kota/Kabupaten</Label>
        <Select
          value={selectedRegencyCode}
          onValueChange={(code) => {
            setRegencyCode(code);
            setDistrictCode("");
            setVillageCode("");
            onChange("memberKotaKabupaten", regencies?.find((item) => item.code === code)?.name ?? "");
            onChange("memberKecamatan", "");
            onChange("memberKelurahan", "");
          }}
          disabled={!selectedProvinceCode || regenciesLoading}
        >
          <SelectTrigger id="memberKotaKabupaten" className={selectClassName}>
            <SelectValue placeholder={regenciesLoading ? "Memuat…" : selectedProvinceCode ? "Pilih Kota/Kabupaten" : "Pilih Provinsi dulu"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {regencies?.map((item) => (
                <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {regenciesError && <p className="text-xs text-destructive">Gagal memuat data kota/kabupaten.</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="memberKecamatan">Kecamatan</Label>
        <Select
          value={selectedDistrictCode}
          onValueChange={(code) => {
            setDistrictCode(code);
            setVillageCode("");
            onChange("memberKecamatan", districts?.find((item) => item.code === code)?.name ?? "");
            onChange("memberKelurahan", "");
          }}
          disabled={!selectedRegencyCode || districtsLoading}
        >
          <SelectTrigger id="memberKecamatan" className={selectClassName}>
            <SelectValue placeholder={districtsLoading ? "Memuat…" : selectedRegencyCode ? "Pilih Kecamatan" : "Pilih Kota/Kabupaten dulu"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {districts?.map((item) => (
                <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {districtsError && <p className="text-xs text-destructive">Gagal memuat data kecamatan.</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="memberKelurahan">Kelurahan/Desa</Label>
        <Select
          value={selectedVillageCode}
          onValueChange={(code) => {
            setVillageCode(code);
            onChange("memberKelurahan", villages?.find((item) => item.code === code)?.name ?? "");
          }}
          disabled={!selectedDistrictCode || villagesLoading}
        >
          <SelectTrigger id="memberKelurahan" className={selectClassName}>
            <SelectValue placeholder={villagesLoading ? "Memuat…" : selectedDistrictCode ? "Pilih Kelurahan/Desa" : "Pilih Kecamatan dulu"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {villages?.map((item) => (
                <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {villagesError && <p className="text-xs text-destructive">Gagal memuat data kelurahan/desa.</p>}
      </div>
    </>
  );
}

export default function MemberDialog({
  editing,
  open,
  setOpen,
}: {
  editing: Member | null;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const createMutation = useCreateMember();
  const updateMutation = useUpdateMember();
  const { data: regionsData } = useRegions(1, 999);
  const { data: familiesData } = useFamilies(1, 999);

  const regionOptions =
    regionsData?.data?.map((region) => ({
      label: region.name,
      value: region.id,
    })) ?? [];

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MemberForm>({
    defaultValues: {
      firstName: "",
      lastName: "",
      birthCity: "",
      gender: "MALE",
      birthDate: "",
      phone: "",
      email: "",
      bloodType: "",
      role: "CHILD",
      childNumber: 0,
      sameAddressAsFamily: true,
      memberAddress: "",
      memberProvinsi: "",
      memberKotaKabupaten: "",
      memberKecamatan: "",
      memberKelurahan: "",
      statusBaptis: "BELUM",
      lokasiBaptis: "",
      tanggalBaptis: "",
      statusSidi: "BELUM",
      lokasiSidi: "",
      tanggalSidi: "",
      statusPerkawinan: "BELUM_MENIKAH",
      lokasiPemberkatanGereja: "",
      tanggalPemberkatanGereja: "",
      lokasiPerkawinanSipil: "",
      tanggalPerkawinanSipil: "",
      jabatan: "WARGA_JEMAAT",
      gerejaAsal: "",
      pendidikanTerakhir: "",
      pekerjaan: "",
      tahunDaftar: "",
      pengalamanGereja: "",
      pengalamanOrganisasi: "",
      keteranganLain: "",
      tanggalPindah: "",
      isActive: true,
      isDeceased: false,
      deathDate: "",
      familyId: "",
    },
  });

  useDialogForm(reset, {
    firstName: "",
    lastName: "",
    birthCity: "",
    gender: "MALE" as const,
    birthDate: "",
    phone: "",
    email: "",
    bloodType: "" as const,
    role: "CHILD" as const,
    childNumber: 0,
    sameAddressAsFamily: true,
    memberAddress: "",
    memberProvinsi: "",
    memberKotaKabupaten: "",
    memberKecamatan: "",
    memberKelurahan: "",
    statusBaptis: "BELUM" as const,
    lokasiBaptis: "",
    tanggalBaptis: "",
    statusSidi: "BELUM" as const,
    lokasiSidi: "",
    tanggalSidi: "",
    statusPerkawinan: "BELUM_MENIKAH" as const,
    lokasiPemberkatanGereja: "",
    tanggalPemberkatanGereja: "",
    lokasiPerkawinanSipil: "",
    tanggalPerkawinanSipil: "",
    jabatan: "WARGA_JEMAAT" as const,
    gerejaAsal: "",
    pendidikanTerakhir: "",
    pekerjaan: "",
    tahunDaftar: "",
    pengalamanGereja: "",
    pengalamanOrganisasi: "",
    keteranganLain: "",
    tanggalPindah: "",
    isActive: true,
    isDeceased: false,
    deathDate: "",
    familyId: "",
  }, { editing, open });

  // Local state for region selection to filter families
  const [dialogRegionId, setDialogRegionId] = useState("");

  // Filter families by selected region
  const familyOptions = useMemo(
    () =>
      familiesData?.data
        ?.filter((family) => !dialogRegionId || family.regionId === dialogRegionId)
        .map((family) => ({
          label: family.familyName,
          value: family.id,
        })) ?? [],
    [familiesData, dialogRegionId],
  );

  // Watch fields for conditional UI
  const selectedRole = useWatch({ control, name: "role" });
  const sameAddress = useWatch({ control, name: "sameAddressAsFamily" });
  const isDeceased = useWatch({ control, name: "isDeceased" });
  const selectedBaptis = useWatch({ control, name: "statusBaptis" });
  const selectedSidi = useWatch({ control, name: "statusSidi" });
  const selectedPerkawinan = useWatch({ control, name: "statusPerkawinan" });
  const memberRegionValues = useWatch({
    control,
    name: [
      "memberProvinsi",
      "memberKotaKabupaten",
      "memberKecamatan",
      "memberKelurahan",
    ],
  });

  async function onSubmit(values: MemberForm) {
    try {
      if (!values.familyId) {
        toast.error("Keluarga wajib dipilih");
        return;
      }

      const payload = {
        ...values,
        email: values.email || "",
        deathDate: values.isDeceased ? values.deathDate : "",
        phone: values.phone || "",
        childNumber: values.role === "CHILD" ? values.childNumber : 0,
        memberAddress: values.sameAddressAsFamily ? "" : values.memberAddress,
        memberProvinsi: values.sameAddressAsFamily ? "" : values.memberProvinsi,
        memberKotaKabupaten: values.sameAddressAsFamily ? "" : values.memberKotaKabupaten,
        memberKecamatan: values.sameAddressAsFamily ? "" : values.memberKecamatan,
        memberKelurahan: values.sameAddressAsFamily ? "" : values.memberKelurahan,
        lokasiBaptis: values.statusBaptis === "SUDAH" ? values.lokasiBaptis : "",
        tanggalBaptis: values.statusBaptis === "SUDAH" ? values.tanggalBaptis : "",
        lokasiSidi: values.statusSidi === "SUDAH" ? values.lokasiSidi : "",
        tanggalSidi: values.statusSidi === "SUDAH" ? values.tanggalSidi : "",
        lokasiPemberkatanGereja: values.statusPerkawinan === "MENIKAH" ? values.lokasiPemberkatanGereja : "",
        tanggalPemberkatanGereja: values.statusPerkawinan === "MENIKAH" ? values.tanggalPemberkatanGereja : "",
        lokasiPerkawinanSipil: values.statusPerkawinan === "MENIKAH" ? values.lokasiPerkawinanSipil : "",
        tanggalPerkawinanSipil: values.statusPerkawinan === "MENIKAH" ? values.tanggalPerkawinanSipil : "",
      };

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      toast.success("Disimpan");
      setOpen(false);
    } catch {
      toast.error("Gagal menyimpan");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {editing ? (
              <>
                <Edit className="h-5 w-5" />
                Edit Warga Jemaat
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Tambah Warga Jemaat
              </>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {editing
              ? "Update the details of this Warga Jemaat member."
              : "Create a new Warga Jemaat member record."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ── SECTION: Sektor & Keluarga ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Sektor Pelayanan & Keluarga
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dialogRegion" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Sektor Pelayanan
                </Label>
                <Select
                  value={dialogRegionId}
                  onValueChange={(value) => {
                    setDialogRegionId(value);
                    setValue("familyId", "");
                  }}
                >
                  <SelectTrigger id="dialogRegion" className="w-full">
                    <SelectValue placeholder="Pilih Sektor Pelayanan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {regionOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="familyId" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Nama Keluarga
                </Label>
                <Controller
                  control={control}
                  name="familyId"
                  rules={{ required: "Keluarga wajib dipilih" }}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!dialogRegionId}
                    >
                      <SelectTrigger id="familyId" className="w-full">
                        <SelectValue
                          placeholder={
                            dialogRegionId
                              ? "Pilih Keluarga"
                              : "Pilih Sektor Pelayanan dulu"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {familyOptions.length === 0 ? (
                            <SelectItem value="__none__" disabled>
                              Tidak ada keluarga di sektor ini
                            </SelectItem>
                          ) : (
                            familyOptions.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.familyId && (
                  <p className="text-sm text-red-500">{errors.familyId.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── SECTION: Data Diri ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Data Diri
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nama Depan
                </Label>
                <Input
                  id="firstName"
                  {...register("firstName", { required: "Nama depan wajib diisi" })}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-500">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nama Belakang
                </Label>
                <Input
                  id="lastName"
                  placeholder="Opsional"
                  {...register("lastName")}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-500">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthCity" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Kota Lahir
                </Label>
                <Input
                  id="birthCity"
                  placeholder="Opsional"
                  {...register("birthCity")}
                />
                {errors.birthCity && (
                  <p className="text-sm text-red-500">{errors.birthCity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">
                  Tanggal Lahir
                </Label>
                <Input
                  id="birthDate"
                  type="date"
                  {...register("birthDate", {
                    required: "Tanggal lahir wajib diisi",
                  })}
                />
                {errors.birthDate && (
                  <p className="text-sm text-red-500">{errors.birthDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Nomor Handphone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Opsional"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-sm text-red-500">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <Controller
                  control={control}
                  name="gender"
                  rules={{ required: "Jenis kelamin wajib diisi" }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.gender && (
                  <p className="text-sm text-red-500">{errors.gender.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Golongan Darah</Label>
                <Controller
                  control={control}
                  name="bloodType"
                  render={({ field }) => (
                    <Select
                      value={field.value === "" ? "none" : field.value}
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Tidak Diketahui" />
                      </SelectTrigger>
                      <SelectContent>
                        {bloodTypeOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Hubungan Keluarga</Label>
                <Controller
                  control={control}
                  name="role"
                  rules={{ required: "Hubungan keluarga wajib diisi" }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {memberRoleOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.role && (
                  <p className="text-sm text-red-500">{errors.role.message}</p>
                )}
              </div>

              {selectedRole === "CHILD" && (
                <div className="space-y-2">
                  <Label htmlFor="childNumber" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Anak ke-
                  </Label>
                  <Input
                    id="childNumber"
                    type="number"
                    min="0"
                    {...register("childNumber", {
                      valueAsNumber: true,
                      min: { value: 0, message: "Minimal 0" },
                    })}
                  />
                  {errors.childNumber && (
                    <p className="text-sm text-red-500">{errors.childNumber.message}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION: Alamat ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Alamat
            </h3>
            <Controller
              control={control}
              name="sameAddressAsFamily"
              render={({ field }) => (
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <span className="text-sm text-muted-foreground">
                    Alamat sama dengan keluarga
                  </span>
                </label>
              )}
            />

            {!sameAddress && (
              <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="memberAddress">Detail Alamat</Label>
                  <Input
                    id="memberAddress"
                    {...register("memberAddress")}
                    placeholder="e.g. Jl. Merdeka No. 123, RT 01/RW 02"
                  />
                </div>
                <IndonesiaMemberRegionSelects
                  key={`${editing?.id ?? "new"}-${open ? "open" : "closed"}`}
                  values={{
                    memberProvinsi: memberRegionValues[0] ?? "",
                    memberKotaKabupaten: memberRegionValues[1] ?? "",
                    memberKecamatan: memberRegionValues[2] ?? "",
                    memberKelurahan: memberRegionValues[3] ?? "",
                  }}
                  onChange={(field, value) => setValue(field, value)}
                />
              </div>
            )}
          </div>

          {/* ── SECTION: Baptis ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Church className="h-4 w-4" />
              Baptis
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status Baptis</Label>
                <Controller
                  control={control}
                  name="statusBaptis"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {baptisStatusOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            {selectedBaptis === "SUDAH" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lokasiBaptis">Lokasi Baptis</Label>
                  <Input id="lokasiBaptis" {...register("lokasiBaptis")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggalBaptis">Tanggal Baptis</Label>
                  <Input id="tanggalBaptis" type="date" {...register("tanggalBaptis")} />
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION: Sidi ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Church className="h-4 w-4" />
              Sidi
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status Sidi</Label>
                <Controller
                  control={control}
                  name="statusSidi"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {sidiStatusOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            {selectedSidi === "SUDAH" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lokasiSidi">Lokasi Sidi</Label>
                  <Input id="lokasiSidi" {...register("lokasiSidi")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggalSidi">Tanggal Sidi</Label>
                  <Input id="tanggalSidi" type="date" {...register("tanggalSidi")} />
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION: Perkawinan ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Perkawinan
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status Perkawinan</Label>
                <Controller
                  control={control}
                  name="statusPerkawinan"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {perkawinanStatusOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            {selectedPerkawinan === "MENIKAH" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lokasiPemberkatanGereja">Lokasi Pemberkatan Gereja</Label>
                  <Input id="lokasiPemberkatanGereja" {...register("lokasiPemberkatanGereja")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggalPemberkatanGereja">Tanggal Pemberkatan Gereja</Label>
                  <Input id="tanggalPemberkatanGereja" type="date" {...register("tanggalPemberkatanGereja")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lokasiPerkawinanSipil">Lokasi Perkawinan Sipil</Label>
                  <Input id="lokasiPerkawinanSipil" {...register("lokasiPerkawinanSipil")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggalPerkawinanSipil">Tanggal Perkawinan Sipil</Label>
                  <Input id="tanggalPerkawinanSipil" type="date" {...register("tanggalPerkawinanSipil")} />
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION: Jabatan ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Jabatan <span className="text-red-500">*</span>
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Jabatan <span className="text-red-500">*</span></Label>
                <Controller
                  control={control}
                  name="jabatan"
                  rules={{ required: "Jabatan wajib dipilih" }}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih Jabatan" />
                      </SelectTrigger>
                      <SelectContent>
                        {jabatanOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.jabatan && (
                  <p className="text-sm text-red-500">{errors.jabatan.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── SECTION: Informasi Lainnya ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informasi Lainnya
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gerejaAsal">Gereja Asal (Pindahan Dari)</Label>
                <Input id="gerejaAsal" {...register("gerejaAsal")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pendidikanTerakhir">Pendidikan Terakhir</Label>
                <Input id="pendidikanTerakhir" {...register("pendidikanTerakhir")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pekerjaan">Pekerjaan</Label>
                <Input id="pekerjaan" {...register("pekerjaan")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tahunDaftar">Tahun Daftar di GPIB Yudea</Label>
                <Input id="tahunDaftar" {...register("tahunDaftar")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pengalamanGereja">Pengalaman Gereja</Label>
                <textarea
                  id="pengalamanGereja"
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
                  {...register("pengalamanGereja")}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pengalamanOrganisasi">Pengalaman Organisasi</Label>
                <textarea
                  id="pengalamanOrganisasi"
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
                  {...register("pengalamanOrganisasi")}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="keteranganLain">Keterangan Lain-Lain</Label>
                <textarea
                  id="keteranganLain"
                  className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
                  {...register("keteranganLain")}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input id="email" type="email" {...register("email")} />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Select
                      value={field.value ? "true" : "false"}
                      onValueChange={(value) => field.onChange(value === "true")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Aktif</SelectItem>
                        <SelectItem value="false">Tidak Aktif</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Status Hidup</Label>
                <Controller
                  control={control}
                  name="isDeceased"
                  render={({ field }) => (
                    <Select
                      value={field.value ? "true" : "false"}
                      onValueChange={(value) => field.onChange(value === "true")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Status hidup" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Hidup</SelectItem>
                        <SelectItem value="true">Meninggal</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {isDeceased && (
                <div className="space-y-2">
                  <Label htmlFor="deathDate">Tanggal Meninggal</Label>
                  <Input
                    id="deathDate"
                    type="date"
                    {...register("deathDate")}
                  />
                </div>
              )}

            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {editing ? (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Simpan
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
