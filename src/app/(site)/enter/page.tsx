import { redirect } from "next/navigation";

/** Entry is now launched as an in-page modal from the homepage. */
export default function EnterPage() {
  redirect("/?enter=1");
}
