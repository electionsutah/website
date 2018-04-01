---
layout: page
title: Places
permalink: /places/
---

{% assign place = site.data.places.utah %}

<section class="info">
  <p><a href="{{ place.wikipedia_url }}">From Wikipedia:</a></p>
  <p class="citation">{{ place.wikipedia_snippet }}</p>
</section>

### 2018 Election

<!-- {% include 2018-elections.html %}

_Coming soon..._

### 2017 Municipal Election -->

<table>
<thead>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
  <tr>
    <td><a href="utah/alpine">Alpine</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/alta">Alta</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/american-fork">American Fork</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/bluffdale">Bluffdale</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/cedar-fort">Cedar Fort</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/cedar-hills">Cedar Hills</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/cottonwood-heights">Cottonwood Heights</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/draper">Draper</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/eagle-mountain">Eagle Mountain</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/elk-ridge">Elk Ridge</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/fairfield">Fairfield</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="weber/farr-west">Farr West</a></td>
    <td><a href="weber">Weber</a></td>
  </tr>
  <tr>
    <td><a href="utah/genola">Genola</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/goshen">Goshen</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="weber/harrisville">Harrisville</a></td>
    <td><a href="weber">Weber</a></td>
  </tr>
  <tr>
    <td><a href="wasatch/heber-city">Heber City</a></td>
    <td><a href="wasatch">Wasatch</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/herriman">Herriman</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/highland">Highland</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/holladay">Holladay</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="weber/huntsville">Huntsville</a></td>
    <td><a href="weber">Weber</a></td>
  </tr>
  <tr>
    <td><a href="weber/hooper">Hooper</a></td>
    <td><a href="weber">Weber</a></td>
  </tr>
  <tr>
    <td><a href="utah/lehi">Lehi</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/lindon">Lindon</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/mapleton">Mapleton</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="weber/marriott-slaterville">Marriott-Slaterville</a></td>
    <td><a href="weber">Weber</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/midvale">Midvale</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/millcreek">Millcreek</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/murray">Murray</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="weber/ogden">Ogden</a></td>
    <td><a href="weber">Weber</a></td>
  </tr>
  <tr>
    <td><a href="utah/orem">Orem</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="summit/park-city">Park City</a></td>
    <td><a href="summit">Summit</a></td>
  </tr>  
  <tr>
    <td><a href="utah/payson">Payson</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/pleasant-grove">Pleasant Grove</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/provo">Provo</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/riverton">Riverton</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/salem">Salem</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/salt-lake-city">Salt Lake City</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/sandy">Sandy</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/santaquin">Santaquin</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/saratoga-springs">Saratoga Springs</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/south-jordan">South Jordan</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/south-salt-lake">South Salt Lake</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/spanish-fork">Spanish Fork</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="utah/springville">Springville</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/taylorsville">Taylorsville</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/vineyard">Vineyard</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/west-jordan">West Jordan</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="salt-lake/west-valley-city">West Valley City</a></td>
    <td><a href="salt-lake">Salt Lake</a></td>
  </tr>
  <tr>
    <td><a href="utah/woodland-hills">Woodland Hills</a></td>
    <td><a href="utah">Utah</a></td>
  </tr>
</tbody>
</table>
