/**
 * Element-pick inspector injected into the workbench preview iframe while
 * pick mode is on (never into published output). Highlights the hovered
 * element and posts a descriptor of the clicked element to the parent.
 */
export const INSPECTOR_SCRIPT = `<script>(function(){
var hl=null,prev='';
function cssPath(el){
  if(el.id)return '#'+CSS.escape(el.id);
  var path=[],node=el;
  while(node&&node.nodeType===1&&node.tagName!=='HTML'){
    if(node.id){path.unshift('#'+CSS.escape(node.id));break}
    var tag=node.tagName.toLowerCase(),parent=node.parentElement;
    if(!parent){path.unshift(tag);break}
    var sibs=Array.prototype.filter.call(parent.children,function(c){return c.tagName===node.tagName});
    path.unshift(sibs.length>1?tag+':nth-of-type('+(sibs.indexOf(node)+1)+')':tag);
    node=parent;
  }
  return path.join(' > ');
}
document.documentElement.style.cursor='crosshair';
document.addEventListener('mouseover',function(e){
  if(hl)hl.style.outline=prev;
  hl=e.target;prev=hl.style.outline;hl.style.outline='2px solid #8b7cff';
},true);
document.addEventListener('click',function(e){
  e.preventDefault();e.stopPropagation();
  var el=e.target;
  parent.postMessage({type:'quark_pick',selector:cssPath(el),tag:el.tagName.toLowerCase(),
    text:(el.textContent||'').trim().slice(0,40),snippet:el.outerHTML.slice(0,600)},'*');
},true);
})()<\/script>`;
