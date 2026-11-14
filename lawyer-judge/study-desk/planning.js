/* Learning scope comes from explicit confirmation, never from title matching. */
export const DEFAULT_INTERVALS=Object.freeze({again:1,hint:3,independent:7});
export function intervals(input=DEFAULT_INTERVALS) {
 const out={};for(const key of ['again','hint','independent']){
  const n=input?.[key];if(!Number.isInteger(n)||n<1||n>365)throw Error('複習間隔須為1到365天的整數');out[key]=n;
 }
 if(out.again>out.hint||out.hint>out.independent)throw Error('複習間隔應由「尚不會」到「可獨立說明」依序增加');
 return out;
}
export function topicScope(question,preferences,lectureState) {
 if(preferences.learnedTopics?.includes(question.topicKey))return {learned:true,basis:'本人確認已學主題'};
 const map=preferences.topicLessons?.[question.topicKey];
 if(!map?.confirmedAt)return {learned:false,basis:'尚未確認已學範圍'};
 const lesson=lectureState?.lessons?.find(l=>l.id===map.lessonId&&l.courseId===map.courseId);
 const course=lectureState?.courses?.find(c=>c.id===map.courseId);
 if(!lesson||!course)return {learned:false,basis:'對應函授堂次已不存在或尚未載入'};
 if(lesson.watchedMinutes<lesson.durationMinutes)return {learned:false,basis:'對應函授尚未看完（'+lesson.watchedMinutes+'／'+lesson.durationMinutes+'分鐘）'};
 return {learned:true,basis:'本人確認對應函授已完成：'+course.name+'／'+lesson.title};
}
export function validateMapping(question,lessonId,state) {
 const lesson=state?.lessons?.find(l=>l.id===lessonId),course=state?.courses?.find(c=>c.id===lesson?.courseId);
 if(!lesson||!course)throw Error('請選擇存在的函授堂次');
 // Composite questions may deliberately be mapped across subjects by the user.
 return {courseId:course.id,lessonId:lesson.id,confirmedAt:new Date().toISOString()};
}
export function readLectures(storage,core) {
 const raw=storage.getItem(core.KEY);return raw===null?null:core.normalize(JSON.parse(raw));
}
export function planLimits(preferences) {
 const input=preferences.planning||{},minutes=input.minutes??30,reviewLimit=input.reviewLimit??2;
 if(!Number.isInteger(minutes)||minutes<5||minutes>240||!Number.isInteger(reviewLimit)||reviewLimit<0||reviewLimit>5)throw Error('時間預算須為5到240分鐘；搭配複習須為0到5題');
 return {minutes,reviewLimit};
}

export function validatePreferences(input) {
 if(!input||typeof input!=='object'||Array.isArray(input)||!input.subjects||typeof input.subjects!=='object'||Array.isArray(input.subjects))throw Error('考科設定格式不符');
 for(const value of Object.values(input.subjects))if(!value||typeof value.enabled!=='boolean'||!Number.isInteger(value.weight)||value.weight<1||value.weight>10)throw Error('考科權重設定格式不符');
 for(const key of ['learnedTopics','weakTopics'])if(input[key]!==undefined&&(!Array.isArray(input[key])||input[key].some(v=>typeof v!=='string')))throw Error('主題清單格式不符');
 if(input.topicLessons!==undefined){
  if(!input.topicLessons||typeof input.topicLessons!=='object'||Array.isArray(input.topicLessons))throw Error('函授主題對應格式不符');
  for(const m of Object.values(input.topicLessons))if(!m||typeof m.courseId!=='string'||typeof m.lessonId!=='string'||typeof m.confirmedAt!=='string'||Number.isNaN(Date.parse(m.confirmedAt)))throw Error('函授主題對應內容不符');
 }
 const output=structuredClone(input);output.learnedTopics??=[];output.reviewIntervals=intervals(input.reviewIntervals);output.planning=planLimits(input);return output;
}
