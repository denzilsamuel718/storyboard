import { redirect } from "next/navigation";

export default function ProfileRedirect() {
  redirect("/creator/profile/edit");
}
