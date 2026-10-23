import { redirect } from "next/navigation";

// The prototype only covers the data section of the OFO site.
export default function Home() {
  redirect("/data");
}
