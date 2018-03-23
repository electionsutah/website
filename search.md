---
layout: page
title: Search
permalink: /search/
comments: disable
---

<section id="search-results" style="display: none;"> </section>

{% raw %}
<script id="search-results-template" type="text/mustache">
    <article>
      {{#entries}}
        <h3>
          <a href="{{url}}">{{title}}</a> {{#date}}&mdash; <small><time datetime="{{pubdate}}" pubdate>{{displaydate}}</time></small>{{/date}}
        </h3>
        {{#is_post}}
        <ul>
          {{#tags}}<li>{{.}} </li>{{/tags}}
        </ul>
        {{/is_post}}
      {{/entries}}
    </article>
</script>
{% endraw %}
