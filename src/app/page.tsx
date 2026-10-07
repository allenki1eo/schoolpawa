import { redirect } from "next/navigation";
import { Welcome } from "@/components/welcome/welcome";
import { currentStudent } from "@/server/session";

export default async function Page() {
  if (await currentStudent()) redirect("/home");
  return <Welcome />;
}
