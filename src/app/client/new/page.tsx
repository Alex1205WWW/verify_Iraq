"use client";

import { useActionState } from "react";
import { createTask, type FormState } from "@/actions/tasks";
import LocationPicker from "@/components/LocationPicker";
import { useT } from "@/components/Intl";

export default function NewTask() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(
    createTask,
    null,
  );

  return (
    <>
      <div className="page-head">
        <h1>{t.client.newTitle}</h1>
        <p>
          {t.client.newSub}
        </p>
      </div>

      <form action={action} className="grid detail-split">
        <div className="stack">
          <div className="card">
            <header>
              <h3>{t.client.where}</h3>
            </header>
            <div className="pad">
              <LocationPicker />
            </div>
          </div>

          <div className="card">
            <header>
              <h3>{t.client.what}</h3>
            </header>
            <div className="pad stack">
              <div className="field">
                <label htmlFor="title">{t.client.shortTitle}</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  placeholder={t.client.shortTitlePlaceholder}
                />
              </div>
              <div className="field">
                <label htmlFor="description">{t.client.whatNeedsVerifying}</label>
                <textarea
                  id="description"
                  name="description"
                  placeholder={t.client.whatPlaceholder}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <header>
              <h3>{t.client.files}</h3>
            </header>
            <div className="pad stack">
              <div className="field">
                <label htmlFor="attachments">{t.client.formAndDocs}</label>
                <input
                  id="attachments"
                  name="attachments"
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                />
                <span className="hint">
                  {t.client.filesHint}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="pad stack">
              {state?.error && <div className="notice bad">{state.error}</div>}
              <button className="btn primary block" type="submit" disabled={pending}>
                {pending ? t.client.filing : t.client.fileThisTask}
              </button>
              <p className="small dim" style={{ margin: 0 }}>
                {t.client.notifiedNote}
              </p>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
