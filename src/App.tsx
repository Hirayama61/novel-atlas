import { LibraryPage } from "./ui/LibraryPage";
import { PullsPage } from "./ui/PullsPage";
import { ReferencePage } from "./ui/references/ReferencePage";
import { ReferenceReaderPage } from "./ui/references/ReferenceReaderPage";
import { ReaderPage } from "./ui/ReaderPage";
import { SettingsPage } from "./ui/SettingsPage";
import { WorkPage } from "./ui/WorkPage";
import { href, useRoute } from "./ui/router";

export default function App() {
  const route = useRoute();
  const isReading = route.page === "reader" || route.page === "referenceReader";
  return (
    <div className={`app ${isReading ? "reading" : ""}`}>
      <header>
        <a className="brand" href={href({ page: "library" })}>
          Novel Atlas
        </a>
        <nav>
          <a href={href({ page: "pulls" })}>PR</a>
          <a href={href({ page: "settings" })}>設定</a>
        </nav>
      </header>
      <main>
        {route.page === "library" ? <LibraryPage /> : null}
        {route.page === "work" ? (
          <WorkPage key={route.ref} work={route.work} tab={route.tab} branch={route.ref} />
        ) : null}
        {route.page === "reader" ? (
          <ReaderPage
            key={`${route.ref}:${route.work}:${route.ep}:${route.line ?? ""}`}
            work={route.work}
            ep={route.ep}
            branch={route.ref}
            pr={route.pr}
            line={route.line}
            initialTab={route.tab}
          />
        ) : null}
        {route.page === "reference" ? <ReferencePage ncode={route.ncode} /> : null}
        {route.page === "referenceReader" ? (
          <ReferenceReaderPage
            key={`${route.ncode}:${route.ep}`}
            ncode={route.ncode}
            ep={route.ep}
          />
        ) : null}
        {route.page === "pulls" ? <PullsPage /> : null}
        {route.page === "settings" ? <SettingsPage /> : null}
      </main>
    </div>
  );
}
