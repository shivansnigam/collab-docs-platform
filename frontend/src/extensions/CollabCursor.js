import { Extension } from "@tiptap/core";
import { Decoration, DecorationSet } from "prosemirror-view";

export const CollabCursor = Extension.create({
  name: "collabCursor",

  addProseMirrorPlugins() {
    return [
      new this.editor.view.PM.Plugin({
        props: {
          decorations: (state) => {
            const awareness = this.options.awareness;
            if (!awareness) return null;

            const decorations = [];
            const clientID = awareness.clientID;

            awareness.getStates().forEach((s, id) => {
              if (id === clientID) return;
              if (!s.user || !s.cursor) return;

              const pos = s.cursor.pos;
              const deco = Decoration.widget(pos, () => {
                const el = document.createElement("div");
                el.style.position = "absolute";
                el.style.transform = "translateY(-20px)";
                el.style.padding = "2px 6px";
                el.style.borderRadius = "4px";
                el.style.fontSize = "12px";
                el.style.color = "#fff";
                el.style.background = s.user.color;
                el.textContent = s.user.name;
                return el;
              });

              decorations.push(deco);
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});