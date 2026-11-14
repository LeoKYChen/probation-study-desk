import {emptyState} from '../cloud-sync/core.js';

// Reset only the desk namespace, never other modules' localStorage or databases.
export function clearedLearningState(state, epoch) {
 const next=emptyState();
 const record=state.records['settings/preferences'];
 if(record&&!record.deleted){
  const preserved=structuredClone(record);
  preserved.value.learnedTopics=[];
  preserved.value.weakTopics=[];
  preserved.value.topicLessons={};
  for(const subject of Object.values(preserved.value.subjects||{}))subject.learned=false;
  next.records['settings/preferences']=preserved;
 }
 next.clearedEpoch=epoch;
 return next;
}
export function assertLearningEpoch(state, epoch) {
 if((state.clearedEpoch||null)!==epoch)throw Error('另一分頁已清除學習紀錄；此草稿未重新存回。請先複製文字，再重新整理。');
}
