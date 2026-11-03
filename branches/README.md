# 平行故事線

主線在根目錄 `STORY_STATE.md` 和 `NEXT_SCENE.md`，平行線在 `branches/<line-id>/` 擁有自己的 `STORY_STATE.md`、`NEXT_SCENE.md`。主線與平行線共用 `CANON.md` 的基本世界觀，**不共用後續事件**。

可先複製 `branches/_TEMPLATE/`，例如 `branches/adler-a-kai/`。切換 AI 時把指定分支檔案提供給 AI，並在提示詞寫清楚 `branch=adler-a-kai`。不可自動合併；需要明確人工核定後才可更新 main。
