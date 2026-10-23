import { redirect } from "next/navigation";

// Forest data is the application landing page.
export default function Home() {
  redirect("/data");
}
