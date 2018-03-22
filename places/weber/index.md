---
layout: page
title: Weber County
permalink: /places/weber/
comments: true
---

<div class="columns">
<ul>
  <li><a href="farr-west">Farr West</a></li>
  <li><a href="harrisville">Harrisville</a></li>
  <li><a href="hooper">Hooper</a></li>
  <li><a href="huntsville">Huntsville</a></li>
  <li><a href="marriott-slaterville">Marriott-Slaterville</a></li>
  <li><a href="ogden">Ogden</a></li>
</ul>
</div>

### 2017 Municipal Election

{% include 2018-elections.html %}

### 2018 Primary Candidates

{% assign county = site.data.2017.primary.candidates | where:'county','Weber' | sort:'name' %}
<table>
<thead>
  <th>Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="../../people/{{member.id}}">{{member.name}}</a></td>
    <td>{{ member.body }}</td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

<!-- {% assign county = site.data.2017.primary.candidates | where:'county','Salt Lake' | sort:'name' %}
{% for member in county  %}
- <strong>[{{member.name }}](../../people/{{member.id}})</strong>, Candidate for <strong>{{ member.body }}</strong> of <strong>[{{ member.city }}](../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}), [{{ member.county }}](../../places/{{ member.county | downcase | replace: ' ','-' }}), [{{ member.state }}](../../places)</strong>
{% endfor %} -->
