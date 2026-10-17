"use strict";
/* Synthetic DOM smoke: validates the actual UI filter/button wiring offline. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const model=require("./model.js");
class MockElement {
  constructor(name) {
    this.name=name;this.children=[];this.attributes={};this.events={};
    this.className="";this.content="";
    this.classList={toggle:()=>{}};
  }
  set textContent(value){this.content=String(value);this.children=[];}
  get textContent(){return this.content;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(name,fn){this.events[name]=fn;}
  getAttribute(name){return this.attributes[name]||null;}
  setAttribute(name,value){this.attributes[name]=value;}
}
const cards=new MockElement("div");
const count=new MockElement("div");
const buttons=["all","law","interpretation"].map(name=>{
  const e=new MockElement("button");e.setAttribute("data-filter",name);return e;
});
const document={
  getElementById:name=>name==="cards"?cards:name==="sample-count"?count:null,
  createElement:name=>new MockElement(name),
  createDocumentFragment:()=>new MockElement("fragment"),
  querySelectorAll:selector=>selector==="[data-filter]"?buttons:[]
};
const context={globalThis:{Stage3rModel:model},document};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,"app.js"),"utf8"),
                context,{timeout:3000});
assert.match(count.textContent,/顯示 5 筆人工合成示例/);
assert.equal(cards.children[0].children.length,5);
buttons[1].events.click();
assert.match(count.textContent,/顯示 2 筆人工合成示例/);
assert.equal(cards.children[0].children.length,2);
buttons[2].events.click();
assert.match(count.textContent,/顯示 3 筆人工合成示例/);
assert.equal(cards.children[0].children.length,3);
buttons[0].events.click();
assert.match(count.textContent,/顯示 5 筆人工合成示例/);
assert.equal(cards.children[0].children.length,5);
assert.ok(buttons[0].events.click);
for(const b of buttons)assert.ok(b.getAttribute("aria-pressed"));
console.log("Stage3r synthetic DOM smoke PASS: all 5, law 2, interpretation 3, back to all 5");
