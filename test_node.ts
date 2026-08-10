import { Shoukaku, Node } from 'shoukaku';
declare const shoukaku: Shoukaku;
const node = shoukaku.nodes.get('test');
if (node) {
    node.connect();
}
