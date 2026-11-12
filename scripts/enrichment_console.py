"""Terminal-only ANSI styling. Machine-readable files and JSON stay plain."""
import os
import re
import sys

CODES={'step':'1;34','prompt':'1;36','warning':'33','success':'32','link':'36','muted':'90'}


def color(text,kind,stream=None):
    stream=sys.stdout if stream is None else stream
    if 'NO_COLOR' in os.environ or os.environ.get('TERM')=='dumb' or not stream.isatty():
        return str(text)
    return '\033['+CODES[kind]+'m'+str(text)+'\033[0m'


def say(text='',kind=None):
    text=str(text)
    if kind is None:
        if re.match(r'\s*[1-4]/4 ',text):kind='step'
        elif text.startswith(('Existing editorial','Reason:','No retrieved','No approved','Stopped')):kind='warning'
        elif text.startswith(('Already recorded','Saved','Review saved')):kind='success'
        elif text.startswith(('Primary source:','Filing evidence:','Run evidence:','Review:','Exact plan:')):kind='link'
    print(color(text,kind) if kind else text)
