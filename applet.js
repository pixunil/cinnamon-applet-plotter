const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;

const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const St = imports.gi.St;

function bind(func, context){
    function callback(){
        try {
            return func.apply(context, arguments);
        } catch(e){
            global.logError(e);
            return null;
        }
    }

    return callback;
}

function Canvas(){
    this._init.apply(this, arguments);
}

Canvas.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    x: 0,
    y: 0,

    scale: 10,
    textScale: .08,

    step: [10, 5, 1],
    size: [.75, .5, .2],

    _init: function(applet){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {activate: false, sensitive: false});

        this.canvas = new St.DrawingArea({width: 400, height: 250});
        this.canvas.connect("repaint", bind(this.draw, this));
        this.addActor(this.canvas, {expand: true, span: -1});

        this.applet = applet;
    },

    repaint: function(){
        this.canvas.queue_repaint();
    },

    draw: function(){
        this.ctx = this.canvas.get_context();
        let w = this.canvas.get_width();
        let h = this.canvas.get_height();

        this.ctx.setSourceRGBA(.8, .8, .8, .5);
        this.ctx.setFontSize(1);

        this.ctx.moveTo(0, h / 2);
        this.ctx.lineTo(w, h / 2);

        this.ctx.moveTo(w / 2, 0);
        this.ctx.lineTo(w / 2, h);

        this.ctx.translate(this.x + w / 2, this.y + h / 2);
        this.ctx.scale(this.scale, -this.scale);

        w /= this.scale;
        h /= this.scale;

        this.x1 = this.x - w / 2;
        this.x2 = this.x1 + w;

        this.y1 = this.y - h / 2;
        this.y1 -= this.y1 % this.step[2];
        this.y2 = this.y1 + h;

        this.layout = PangoCairo.create_layout(this.ctx);

        let description = Pango.FontDescription.from_string("Noto Sans 10");
        this.layout.set_font_description(description);

        this.drawAxis();
        this.drawFunctions();
    },

    drawAxis: function(){
        for(let x = this.x1 - this.x1 % this.step[2]; x <= this.x2; x += this.step[2]){
            if(x === 0)
                continue;

            let size = this.size[2];
            if(x % this.step[1] === 0){
                size = this.size[1];
                this.drawAxisText(x, x, null);
            }
            if(x % this.step[0] === 0)
                size = this.size[0];

            this.ctx.moveTo(x, -size);
            this.ctx.lineTo(x, size);
        }

        for(let y = this.y1 - this.y1 % this.step[2]; y <= this.y2; y += this.step[2]){
            if(y === 0){
                this.drawAxisText(0, null, null);
                continue;
            }

            let size = this.size[2];
            if(y % this.step[1] === 0){
                size = this.size[1];
                this.drawAxisText(y, null, y);
            }
            if(y % this.step[0] === 0)
                size = this.size[0];

            this.ctx.moveTo(-size, y);
            this.ctx.lineTo(size, y);
        }

        this.ctx.save();
        this.ctx.identityMatrix();
        this.ctx.stroke();
        this.ctx.restore();
    },

    drawAxisText: function(text, x, y){
        this.ctx.save();
        this.ctx.scale(this.textScale, this.textScale);
        PangoCairo.update_layout(this.ctx, this.layout);

        this.layout.set_text(text + "", -1);
        let size = this.layout.get_extents()[0];

        if(x === null && y === null){
            x = -1 / this.textScale - size.width / Pango.SCALE;
            y = -1 / this.textScale;
        } else if(x === null){
            x = -1 / this.textScale - size.width / Pango.SCALE;
            y = y / this.textScale + size.height / Pango.SCALE;
        } else if(y === null){
            x = x / this.textScale - size.width / 2 / Pango.SCALE;
            y = -1 / this.textScale;
        }

        this.ctx.moveTo(x, y);
        this.ctx.scale(1, -1);

        PangoCairo.show_layout(this.ctx, this.layout);
        this.ctx.restore();
    },

    drawFunctions: function(){
        this.ctx.setSourceRGB(1, .5, 0);

        let entries = this.applet.entries._getMenuItems();
        for(let i = 0, l = entries.length; i < l; ++i){
            if(entries[i].func)
                this.drawFunction(entries[i].func);
        }
    },

    drawFunction: function(func){
        for(let x = this.x1; x <= this.x2; x += .5 / this.scale){
            let y;
            try {
                y = func(x);
            } catch(e){
                continue;
            }

            this.ctx.lineTo(x, func(x));
        }

        this.ctx.save();
        this.ctx.identityMatrix();
        this.ctx.stroke();
        this.ctx.restore();
    }
};

function MathEntryMenuItem(){
    this._init.apply(this, arguments);
}

MathEntryMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(applet, text){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {activate: false});

        this.applet = applet;

        this.entry = new MathEntry(this, text);
        this.addActor(this.entry.actor, {span: -1, expand: true});

        this.entry.entryText.connect("text-changed", bind(this.onTextChanged, this));

        this.onTextChanged();
    },

    _onKeyFocusIn: function(){},
    _onKeyFocusOut: function(){},

    onTextChanged: function(){
        this.func = null;

        if(this.entry.text){
            let text = "return " + this.entry.text + ";";

            try {
                this.func = Function.constructor.call(null, ["x"], text);
                this.applet.canvas.repaint();
            } catch(e){
                this.func = null;
            }
        }

        this.setShowDot(this.func);
    }
};

function AddMathEntryMenuItem(){
    this._init.apply(this, arguments);
}

AddMathEntryMenuItem.prototype = {
    __proto__: MathEntryMenuItem.prototype,

    _init: function(applet){
        MathEntryMenuItem.prototype._init.call(this, applet, "");

        this.actor.connect("enter-event", bind(function(){
            this.actor.remove_style_class_name("popup-inactive-menu-item");
        }, this));
        this.actor.connect("leave-event", bind(function(){
            this.actor.add_style_class_name("popup-inactive-menu-item");
        }, this));

        this.entry.actor.hint_text = _("Add function ...");
        this.entry.entryText.connect("key-press-event", bind(this.onKeyPress, this));
    },

    onKeyPress: function(actor, event){
        let symbol = event.get_key_symbol();
        if(symbol === Clutter.KEY_Return){
            let menuItem = new MathEntryMenuItem(this.applet, this.entry.text);
            this.applet.entries.addMenuItem(menuItem);
            this.entry.text = "";

            return true;
        }
        return false;
    },

    onTextChanged: function(){}
};

function MathEntry(){
    this._init.apply(this, arguments);
}

MathEntry.prototype = {
    _init: function(parent, text){
        this.actor = new St.Entry({text: text});

        this.entryText = this.actor.clutter_text;
    },

    get text(){
        return this.entryText.text;
    },

    set text(text){
        this.entryText.text = text;
    }
};

function PlotterApplet(metadata, orientation, panelHeight, instanceId){
    this._init(metadata, orientation, panelHeight, instanceId);
}

PlotterApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId){
        try {
            Applet.IconApplet.prototype._init.call(this, orientation, panelHeight);

            this.set_applet_icon_symbolic_name("accessories-calculator");

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.canvas = new Canvas(this);
            this.entries = new PopupMenu.PopupMenuSection;
            let entryMenuItem = new AddMathEntryMenuItem(this);

            this.menu.addMenuItem(this.canvas);
            this.menu.addMenuItem(this.entries);
            this.menu.addMenuItem(entryMenuItem);
        } catch(e){
            global.logError(e);
        }
    },

    on_applet_clicked: function(){
        this.menu.toggle();
    }
};

function main(metadata, orientation, panelHeight, instanceId){
    return new PlotterApplet(metadata, orientation, panelHeight, instanceId);
}
